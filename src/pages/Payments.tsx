import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { logAudit } from "@/lib/audit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, IndianRupee, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Customer { id: string; name: string; phone: string | null; }
interface Payment {
  id: string;
  student_id: string;
  amount: number;
  paid_on: string;
  method: string;
  duration_months: number | null;
  duration_value: number | null;
  duration_unit: string | null;
  valid_until: string | null;
}

const paymentMethods = ["cash", "upi", "card", "bank-transfer", "other"];
type Unit = "days" | "months" | "years";
const unitOptions: { value: Unit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];
const unitMax: Record<Unit, number> = { days: 365, months: 60, years: 10 };

const addDuration = (isoDate: string, value: number, unit: Unit): string => {
  if (!isoDate || !value || value <= 0) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (unit === "days") {
    const dt = new Date(Date.UTC(y, m - 1, d + value));
    return dt.toISOString().slice(0, 10);
  }
  const months = unit === "years" ? value * 12 : value;
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  if (dt.getUTCDate() !== d) dt.setUTCDate(0);
  return dt.toISOString().slice(0, 10);
};

const Payments = () => {
  const { user } = useAuth();
  const { ownerId } = useStudio();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    amount: "",
    paid_on: new Date().toISOString().slice(0, 10),
    method: "cash",
    durationValue: "1",
    durationUnit: "months" as Unit,
  });

  const effectiveValue = useMemo(() => {
    const n = parseInt(form.durationValue, 10);
    if (!Number.isFinite(n) || n < 1) return 0;
    return Math.min(n, unitMax[form.durationUnit]);
  }, [form.durationValue, form.durationUnit]);

  const renewalDate = useMemo(
    () => addDuration(form.paid_on, effectiveValue, form.durationUnit),
    [form.paid_on, effectiveValue, form.durationUnit]
  );

  const fetchAll = async () => {
    if (!user) return;
    const [{ data: cust }, { data: pays }] = await Promise.all([
      supabase.from("students").select("id,name,phone").eq("user_id", user.id).order("name"),
      supabase.from("student_payments").select("*").eq("user_id", user.id).order("paid_on", { ascending: false }),
    ]);
    setCustomers((cust as Customer[]) || []);
    setPayments(((pays as any[]) || []) as Payment[]);
  };
  useEffect(() => { fetchAll(); }, [user]);

  const grouped = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach((p) => {
      if (!map.has(p.student_id)) map.set(p.student_id, []);
      map.get(p.student_id)!.push(p);
    });
    return map;
  }, [payments]);

  const toggle = (id: string) => {
    const n = new Set(expanded);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpanded(n);
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(form.amount);
    if (!form.student_id) { toast.error("Pick a customer"); return; }
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!effectiveValue) { toast.error("Enter a valid duration"); return; }
    if (!renewalDate) { toast.error("Could not calculate renewal date"); return; }

    const months_equiv =
      form.durationUnit === "months" ? effectiveValue :
      form.durationUnit === "years" ? effectiveValue * 12 :
      Math.max(1, Math.round(effectiveValue / 30));

    const { error } = await supabase.from("student_payments").insert({
      student_id: form.student_id,
      user_id: user.id,
      amount,
      paid_on: form.paid_on,
      method: form.method,
      duration_value: effectiveValue,
      duration_unit: form.durationUnit,
      duration_months: months_equiv,
      valid_until: renewalDate,
      reminder_sent_at: null,
    } as any);
    if (error) { toast.error(error.message); return; }
    await logAudit(ownerId, "payment.created", { amount, duration_value: effectiveValue, duration_unit: form.durationUnit, valid_until: renewalDate }, { type: "student_payment", id: form.student_id });
    toast.success("Payment recorded · renewal scheduled");
    setForm({ ...form, amount: "", durationValue: "1" });
    setAddOpen(false);
    fetchAll();
  };

  const deletePayment = async (id: string) => {
    await supabase.from("student_payments").delete().eq("id", id);
    await logAudit(ownerId, "payment.deleted", {}, { type: "student_payment", id });
    toast.success("Removed"); fetchAll();
  };

  const grandTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground mt-1">Owner-only — grouped per customer</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Record Payment</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Record Payment</DialogTitle>
              <DialogDescription>Renewal date is auto-calculated from duration.</DialogDescription>
            </DialogHeader>
            <form onSubmit={addPayment} className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Paid on</Label><Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{paymentMethods.map((m) => <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration Unit</Label>
                  <Select value={form.durationUnit} onValueChange={(v) => setForm({ ...form, durationUnit: v as Unit })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{unitOptions.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration Value <span className="text-muted-foreground text-xs">(1–{unitMax[form.durationUnit]} {form.durationUnit})</span></Label>
                <Input
                  type="number"
                  min={1}
                  max={unitMax[form.durationUnit]}
                  step={1}
                  placeholder="e.g. 3"
                  value={form.durationValue}
                  onChange={(e) => setForm({ ...form, durationValue: e.target.value.replace(/[^0-9]/g, "") })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Renewal Date <span className="text-muted-foreground text-xs">(auto)</span></Label>
                <Input type="date" value={renewalDate} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
              <Button type="submit" className="w-full">Save Payment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary font-medium">Total Collected</p>
            <p className="font-display text-3xl font-bold mt-1 flex items-center"><IndianRupee className="h-6 w-6" />{grandTotal.toLocaleString()}</p>
          </div>
          <p className="text-sm text-muted-foreground">{payments.length} payment{payments.length === 1 ? "" : "s"}</p>
        </CardContent>
      </Card>

      {customers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Add customers first to record payments.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {customers.map((c) => {
            const list = grouped.get(c.id) || [];
            const total = list.reduce((s, p) => s + Number(p.amount), 0);
            const isOpen = expanded.has(c.id);
            return (
              <Card key={c.id}>
                <CardContent className="p-0">
                  <button onClick={() => toggle(c.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{c.name}</h3>
                        <p className="text-xs text-muted-foreground">{list.length} payment{list.length === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <span className="font-display font-bold text-lg shrink-0">₹{total.toLocaleString()}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border">
                      {list.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground italic text-center">No payments yet.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {list.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 p-3 px-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold">₹{Number(p.amount).toLocaleString()}</span>
                                  {p.duration_months ? (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                      {p.duration_months} mo
                                    </span>
                                  ) : null}
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase">{p.method}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Paid {new Date(p.paid_on).toLocaleDateString()}
                                  {p.valid_until ? ` · renews ${new Date(p.valid_until).toLocaleDateString()}` : ""}
                                </p>
                              </div>
                              <button onClick={() => deletePayment(p.id)} aria-label="Delete" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Payments;
