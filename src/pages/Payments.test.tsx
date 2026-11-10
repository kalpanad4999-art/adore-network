import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), audit: vi.fn(), error: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
vi.mock("@/contexts/StudioContext", () => ({ useStudio: () => ({ ownerId: "owner", studioName: "Studio" }) }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/components/PaymentReceiptDialog", () => ({ default: () => null }));
vi.mock("recharts", () => ({
  ResponsiveContainer: () => null, AreaChart: () => null, Area: () => null,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children, disabled }: any) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)} disabled={disabled}>{children}</select>
  ),
  SelectTrigger: () => <option value="">Select</option>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const data = table === "students" ? [{ id: "member", name: "Member", batch_id: "batch" }]
        : table === "batches" ? [{ id: "batch", name: "Batch", fee: 1000 }] : [];
      const query: any = { select: () => query, eq: () => query, order: () => query,
        then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve),
        insert: (payload: unknown) => { mocks.insert(payload); return { select: () => ({ single: () => pendingInsert }) }; },
      };
      return query;
    },
    channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
    removeChannel: vi.fn(),
  },
}));

import Payments from "./Payments";

let pendingInsert: Promise<any>;
let finishInsert: (result: any) => void;
const deferInsert = () => {
  pendingInsert = new Promise((resolve) => { finishInsert = resolve; });
};
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); deferInsert(); mocks.audit.mockResolvedValue(undefined); });
afterEach(cleanup);

async function openForm() {
  fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
  await waitFor(() => expect(screen.getByRole("option", { name: "Member" })).toBeInTheDocument());
}
async function chooseMember() {
  const dialog = screen.getByRole("dialog");
  const selects = dialog.querySelectorAll("select");
  fireEvent.change(selects[0], { target: { value: "batch" } });
  fireEvent.change(selects[1], { target: { value: "member" } });
  return dialog.querySelector("form") as HTMLFormElement;
}
async function startPayment() {
  await openForm();
  return chooseMember();
}

describe("payment submission safety", () => {
  it("creates one payment/renewal entry for two immediate submit events", async () => {
    render(<Payments />);
    // Wait for the initial member/batch read before opening the form.
    await waitFor(() => expect(screen.getByRole("option", { name: "Batch" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    const form = await chooseMember();
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ student_id: "member", amount: 1000, duration_value: 1, duration_unit: "months" });
    await act(async () => finishInsert({ data: { id: "payment-1" }, error: null }));
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });

  it("allows a separate intentional payment with the same member and amount", async () => {
    render(<Payments />);
    await waitFor(() => expect(screen.getByRole("option", { name: "Batch" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    fireEvent.submit(await chooseMember());
    await act(async () => finishInsert({ data: { id: "payment-1" }, error: null }));
    deferInsert();
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    fireEvent.submit(await chooseMember());
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.mock.calls[1][0]).toMatchObject({ student_id: "member", amount: 1000 });
    await act(async () => finishInsert({ data: { id: "payment-2" }, error: null }));
  });

  it.each(["returned", "thrown"])("releases the lock after a %s failure so retry works", async (failure) => {
    render(<Payments />);
    await waitFor(() => expect(screen.getByRole("option", { name: "Batch" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Record Payment" }));
    const form = await chooseMember();
    if (failure === "thrown") pendingInsert = Promise.reject(new Error("Connection failed"));
    fireEvent.submit(form);
    await act(async () => {
      if (failure === "returned") finishInsert({ data: null, error: { message: "Save failed" } });
    });
    expect(mocks.error).toHaveBeenCalledTimes(1);
    deferInsert();
    fireEvent.submit(form);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    await act(async () => finishInsert({ data: { id: "retry" }, error: null }));
  });
});