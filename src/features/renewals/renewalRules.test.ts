import { describe, expect, it } from "vitest";
import { buildRenewals, pendingRenewals, renewalNotificationId, unseenRenewals, RenewalPayment } from "./renewalRules";

const customers = [{ id: "member", name: "Test Member", phone: "9876543210", batch_id: null }];
const payment: RenewalPayment = { id: "payment", student_id: "member", amount: 1000, due_amount: 250, paid_on: "2026-10-03", valid_until: "2026-11-03", duration_months: 1, reminder_sent_at: null };
const today = new Date(2026, 10, 3, 12);
describe("renewal notifications", () => {
  it("includes a renewal due today", () => { expect(pendingRenewals(buildRenewals(customers, [payment], today))).toHaveLength(1); });
  it("includes overdue renewals", () => { expect(pendingRenewals(buildRenewals(customers, [{ ...payment, valid_until: "2026-11-02" }], today))[0]?.bucket).toBe("expired"); });
  it("excludes future renewals", () => { expect(pendingRenewals(buildRenewals(customers, [{ ...payment, valid_until: "2026-11-04" }], today))).toHaveLength(0); });
  it("excludes members without renewal dates", () => { expect(pendingRenewals(buildRenewals(customers, [{ ...payment, valid_until: null }], today))).toHaveLength(0); });
  it("uses the latest payment so a renewed member leaves the pending list", () => { expect(pendingRenewals(buildRenewals(customers, [payment, { ...payment, id: "new", paid_on: "2026-11-03", valid_until: "2026-12-03" }], today))).toHaveLength(0); });
  it("preserves registered phone and existing pending amount", () => {
    const r = buildRenewals(customers, [payment], today)[0];
    expect(r.customer.phone).toBe("9876543210"); expect(r.latest?.due_amount).toBe(250);
  });
  it("does not repeat a dismissed renewal after refresh or when overdue", () => {
    const rows = buildRenewals(customers, [payment], today);
    const dismissed = new Set([renewalNotificationId(rows[0])]);
    expect(unseenRenewals(buildRenewals(customers, [payment], new Date(2026, 10, 4)), dismissed)).toHaveLength(0);
    expect(pendingRenewals(rows)).toHaveLength(1);
  });
  it("allows a new renewal for the same member", () => {
    const old = buildRenewals(customers, [payment], today)[0];
    expect(unseenRenewals(buildRenewals(customers, [{ ...payment, id: "next" }], today), new Set([renewalNotificationId(old)]))).toHaveLength(1);
  });
  it("produces one notification per member even with historical payments", () => { expect(pendingRenewals(buildRenewals(customers, [payment, { ...payment, id: "old", paid_on: "2026-09-03" }], today))).toHaveLength(1); });
});