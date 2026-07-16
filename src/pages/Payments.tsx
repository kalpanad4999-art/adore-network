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
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import PaymentReceiptDialog, { ReceiptData } from "@/components/PaymentReceiptDialog";
import { FileText, Tag } from "lucide-react";
import { Offer, Coupon, OFFER_LABELS, CONGRATS, computeDiscount, isOfferEligible } from "@/lib/offers";
import { Badge } from "@/components/ui/badge";

interface Customer { id: string; name: string; phone: string | null; batch_id: string | null; }
interface Batch { id: string; name: string; }
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

type RangeKey = "today" | "week" | "month" | "year" | "all";
const rangeOptions: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

const startOfRange = (key: RangeKey): Date | null => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "today": return d;
    case "week": {
      const dow = d.getDay(); // 0 Sun..6 Sat
      const diff = (dow + 6) % 7; // week starts Monday
      d.setDate(d.getDate() - diff);
      return d;
    }
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year": return new Date(now.getFullYear(), 0, 1);
    case "all": return null;
  }
};

const Payments = () => {
  const { user } = useAuth();
  const { ownerId, studioName } = useStudio();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [range, setRange] = useState<RangeKey>("month");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [studioAddress, setStudioAddress] = useState<string>("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [couponInput, setCouponInput] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
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
    const [{ data: cust }, { data: pays }, { data: bat }, { data: offs }, { data: cps }] = await Promise.all([
      supabase.from("students").select("id,name,phone,batch_id").eq("user_id", user.id).order("name"),
      supabase.from("student_payments").select("*").eq("user_id", user.id).order("paid_on", { ascending: false }),
      supabase.from("batches").select("id,name").eq("user_id", user.id),
      (supabase as any).from("offers").select("*").eq("user_id", user.id).eq("is_active", true),
      (supabase as any).from("coupons").select("*").eq("user_id", user.id).eq("is_active", true),
    ]);
    setCustomers((cust as Customer[]) || []);
    setPayments(((pays as any[]) || []) as Payment[]);
    setBatches((bat as Batch[]) || []);
    setOffers(((offs as any[]) || []).map((o) => ({ ...o, conditions: o.conditions || {} })) as Offer[]);
    setCoupons(((cps as any[]) || []) as Coupon[]);
  };
  useEffect(() => { fetchAll(); }, [user]);

  // Eligible offers for the current form context
  const eligibleOffers = useMemo(() => {
    const amt = parseFloat(form.amount) || 0;
    const cust = customers.find((c) => c.id === form.student_id);
    const ctx = cust ? { id: cust.id, batch_id: cust.batch_id } : null;
    return offers.filter((o) => isOfferEligible(o, ctx as any, amt, form.paid_on));
  }, [offers, form.student_id, form.amount, form.paid_on, customers]);

  const selectedOffer = useMemo(() => {
    if (appliedCoupon) return offers.find((o) => o.id === appliedCoupon.offer_id) || null;
    return offers.find((o) => o.id === selectedOfferId) || null;
  }, [selectedOfferId, appliedCoupon, offers]);

  const discountAmount = useMemo(() => {
    const amt = parseFloat(form.amount) || 0;
    if (!selectedOffer || !amt) return 0;
    return computeDiscount(selectedOffer, amt);
  }, [selectedOffer, form.amount]);

  const finalAmount = useMemo(() => {
    const amt = parseFloat(form.amount) || 0;
    return Math.max(0, amt - discountAmount);
  }, [form.amount, discountAmount]);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    const c = coupons.find((x) => x.code.toUpperCase() === code);
    if (!c) { toast.error("Invalid coupon code"); return; }
    if (c.usage_limit != null && c.usage_count >= c.usage_limit) { toast.error("Coupon has reached its usage limit"); return; }
    const offer = offers.find((o) => o.id === c.offer_id);
    if (!offer) { toast.error("Coupon's offer is not available"); return; }
    const amt = parseFloat(form.amount) || 0;
    const cust = customers.find((cc) => cc.id === form.student_id);
    const ctx = cust ? { id: cust.id, batch_id: cust.batch_id } : null;
    if (!isOfferEligible(offer, ctx as any, amt, form.paid_on)) { toast.error("Coupon is not eligible for this payment"); return; }
    setAppliedCoupon(c);
    setSelectedOfferId(offer.id);
    toast.success(`Coupon applied — ₹${computeDiscount(offer, amt)} off`);
  };

  const clearOffer = () => {
    setAppliedCoupon(null);
    setSelectedOfferId("");
    setCouponInput("");
  };

  const batchMap = useMemo(() => {
    const m = new Map<string, string>();
    batches.forEach((b) => m.set(b.id, b.name));
    return m;
  }, [batches]);

  const selectedCustomer = customers.find((c) => c.id === form.student_id);
  const selectedBatchName = selectedCustomer?.batch_id ? (batchMap.get(selectedCustomer.batch_id) || "No Batch Assigned") : "No Batch Assigned";

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

    const { data: inserted, error } = await supabase.from("student_payments").insert({
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
    } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    await logAudit(ownerId, "payment.created", { amount, duration_value: effectiveValue, duration_unit: form.durationUnit, valid_until: renewalDate }, { type: "student_payment", id: form.student_id });
    toast.success("Payment recorded · renewal scheduled");

    // Prepare receipt for the just-recorded payment
    const cust = customers.find((c) => c.id === form.student_id);
    const batchName = cust?.batch_id ? (batchMap.get(cust.batch_id) || "No Batch Assigned") : "No Batch Assigned";
    const receiptNo = `TY-${new Date(form.paid_on).toISOString().slice(0,10).replace(/-/g,"")}-${(inserted?.id || "").slice(0,6).toUpperCase()}`;
    setReceiptData({
      receiptNumber: receiptNo,
      dateIssued: form.paid_on,
      customerName: cust?.name || "—",
      customerContact: cust?.phone || undefined,
      batchName,
      planDescription: `${batchName} Membership · ${effectiveValue} ${form.durationUnit}`,
      paymentMethod: form.method,
      amount,
      durationValue: effectiveValue,
      durationUnit: form.durationUnit,
      renewalDate,
      studioName: studioName || "Trinetra Yoga",
      studioAddress: studioAddress || undefined,
    });
    setReceiptOpen(true);

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

  // Income Overview chart data
  const chartData = useMemo(() => {
    const start = startOfRange(range);
    const filtered = start
      ? payments.filter((p) => new Date(p.paid_on) >= start)
      : payments;

    const buckets = new Map<string, number>();
    const isDaily = range === "today" || range === "week" || range === "month";
    filtered.forEach((p) => {
      const d = new Date(p.paid_on);
      const key = isDaily
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, (buckets.get(key) || 0) + Number(p.amount));
    });
    const rows = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        const label = isDaily
          ? k.slice(5) // MM-DD
          : k; // YYYY-MM
        return { label, amount: v };
      });
    return rows;
  }, [payments, range]);

  const rangeTotal = chartData.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl font-bold">Payments</h1>
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
                <Label>Member</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Batch <span className="text-muted-foreground text-xs">(auto)</span></Label>
                <Input value={form.student_id ? selectedBatchName : ""} readOnly disabled placeholder="Select a customer first" className="bg-muted/50 cursor-not-allowed" />
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

      {/* Income Overview */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-xl font-bold">Income Overview</h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center">
                <IndianRupee className="h-3 w-3" />{rangeTotal.toLocaleString()} in selected range
              </p>
            </div>
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {rangeOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="h-64 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No income in this range.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={60} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(v: number) => [`₹${Number(v).toLocaleString()}`, "Income"]}
                  />
                  <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#incomeFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
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
                                  {(p.duration_value && p.duration_unit) ? (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                      {p.duration_value} {p.duration_unit}
                                    </span>
                                  ) : p.duration_months ? (
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
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    const batchName = c.batch_id ? (batchMap.get(c.batch_id) || "No Batch Assigned") : "No Batch Assigned";
                                    const unit = p.duration_unit || (p.duration_months ? "months" : "months");
                                    const val = p.duration_value ?? p.duration_months ?? 1;
                                    const receiptNo = `TY-${new Date(p.paid_on).toISOString().slice(0,10).replace(/-/g,"")}-${p.id.slice(0,6).toUpperCase()}`;
                                    setReceiptData({
                                      receiptNumber: receiptNo,
                                      dateIssued: p.paid_on,
                                      customerName: c.name,
                                      customerContact: c.phone || undefined,
                                      batchName,
                                      planDescription: `${batchName} Membership · ${val} ${unit}`,
                                      paymentMethod: p.method,
                                      amount: Number(p.amount),
                                      durationValue: val,
                                      durationUnit: unit,
                                      renewalDate: p.valid_until || "",
                                      studioName: studioName || "Trinetra Yoga",
                                      studioAddress: studioAddress || undefined,
                                    });
                                    setReceiptOpen(true);
                                  }}
                                  aria-label="Generate Bill"
                                  title="Generate Bill"
                                  className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                <button onClick={() => deletePayment(p.id)} aria-label="Delete" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                              </div>
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
      <PaymentReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />
    </div>
  );
};

export default Payments;
