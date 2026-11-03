export interface RenewalCustomer { id: string; name: string; phone: string | null; batch_id: string | null; }
export interface RenewalBatch { id: string; name: string; }
export interface RenewalPayment {
  id: string;
  student_id: string;
  amount: number;
  paid_on: string;
  duration_months: number | null;
  valid_until: string | null;
  reminder_sent_at: string | null;
  due_amount?: number | null;
}
export type Bucket = "active" | "due_7" | "due_3" | "due_today" | "expired";
export interface Renewal {
  customer: RenewalCustomer;
  latest: RenewalPayment | null;
  previous: RenewalPayment | null;
  renewalDate: string | null;
  daysRemaining: number | null;
  bucket: Bucket | null;
  reminderState: "not_sent" | "sent" | "renewed";
}

export function buildRenewals(customers: RenewalCustomer[], payments: RenewalPayment[], now = new Date()): Renewal[] {
  const byCustomer = new Map<string, RenewalPayment[]>();
  for (const payment of payments) {
    const rows = byCustomer.get(payment.student_id) ?? [];
    rows.push(payment);
    byCustomer.set(payment.student_id, rows);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return customers.map((customer) => {
    // Preserve the existing Renewal screen's payment ordering and expiry buckets.
    const rows = (byCustomer.get(customer.id) ?? []).slice().sort((a, b) => b.paid_on > a.paid_on ? 1 : -1);
    const latest = rows[0] ?? null;
    const previous = rows[1] ?? null;
    const renewalDate = latest?.valid_until || null;
    let daysRemaining: number | null = null;
    let bucket: Bucket | null = null;
    const match = renewalDate && /^(\d{4})-(\d{2})-(\d{2})/.exec(renewalDate);
    if (match) {
      const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (!isNaN(target.getTime())) {
        daysRemaining = Math.round((target.getTime() - today.getTime()) / 86400000);
        bucket = daysRemaining < 0 ? "expired" : daysRemaining === 0 ? "due_today" : daysRemaining <= 3 ? "due_3" : daysRemaining <= 7 ? "due_7" : "active";
      }
    }
    let reminderState: Renewal["reminderState"] = "not_sent";
    if (latest && previous?.valid_until && latest.paid_on >= previous.valid_until.slice(0, 10) && bucket === "active") reminderState = "renewed";
    if (latest?.reminder_sent_at && reminderState === "not_sent") reminderState = "sent";
    return { customer, latest, previous, renewalDate, daysRemaining, bucket, reminderState };
  });
}

export const pendingRenewals = (renewals: Renewal[]) => renewals.filter(r => r.bucket === "due_today" || r.bucket === "expired");
// A different payment or expiry date represents a new renewal, even for the same member.
export const renewalNotificationId = (r: Renewal) => `${r.customer.id}:${r.latest?.id}:${r.renewalDate}`;
export const unseenRenewals = (renewals: Renewal[], dismissed: ReadonlySet<string>) => pendingRenewals(renewals).filter(r => !dismissed.has(renewalNotificationId(r)));