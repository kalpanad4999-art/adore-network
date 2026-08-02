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
import { Plus, Trash2, IndianRupee, ChevronDown, ChevronRight, MoreVertical, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import PaymentReceiptDialog, { ReceiptData } from "@/components/PaymentReceiptDialog";
import { FileText, Tag } from "lucide-react";
import { Offer, Coupon, OFFER_LABELS, CONGRATS, computeDiscount, isOfferEligible } from "@/lib/offers";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtDateFile } from "@/lib/date";

interface Customer { id: string; name: string; phone: string | null; batch_id: string | null; }
interface Batch { id: string; name: string; fee?: number | null; }
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
  applied_offer_id?: string | null;
  applied_offer_name?: string | null;
  applied_offer_type?: string | null;
  applied_coupon_code?: string | null;
  discount_amount?: number | null;
}

const paymentMethods = ["cash", "upi", "card", "bank-transfer", "other"];
type Unit = "days" | "months" | "years";
const unitOptions: { value: Unit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];
const unitMax: Record<Unit, number> = { days: 365, months: 60, years: 10 };

// Renewal date = one day before the same date in the next membership cycle.
// e.g. 30/07/2026 + 1 month -> 29/08/2026
const addDuration = (isoDate: string, value: number, unit: Unit): string => {
  if (!isoDate || !value || value <= 0) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (unit === "days") {
    const dt = new Date(Date.UTC(y, m - 1, d + value - 1));
    return dt.toISOString().slice(0, 10);
  }
  const months = unit === "years" ? value * 12 : value;
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  if (dt.getUTCDate() !== d) dt.setUTCDate(0); // clamp to end of shorter month
  dt.setUTCDate(dt.getUTCDate() - 1);
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
  const workspaceId = ownerId ?? user?.id ?? null;
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
  const [filterBatchId, setFilterBatchId] = useState<string>("");
  // Batch chosen inside the Record Payment form (required, selected first).
  const [formBatchId, setFormBatchId] = useState<string>("");
  // Members whose payment entry was fully removed from the Payments section.
  // Purely a Payments-section view state — the member profile itself is untouched.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
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
    if (!workspaceId) return;
    const [{ data: cust }, { data: pays }, { data: bat }, { data: offs }, { data: cps }] = await Promise.all([
      supabase.from("students").select("id,name,phone,batch_id").eq("user_id", workspaceId).order("name"),
      supabase.from("student_payments").select("*").eq("user_id", workspaceId).order("paid_on", { ascending: false }),
      supabase.from("batches").select("id,name,fee").eq("user_id", workspaceId),
      (supabase as any).from("offers").select("*").eq("user_id", workspaceId).eq("is_active", true),
      (supabase as any).from("coupons").select("*").eq("user_id", workspaceId).eq("is_active", true),
    ]);
    setCustomers((cust as Customer[]) || []);
    setPayments(((pays as any[]) || []) as Payment[]);
    setBatches((bat as Batch[]) || []);
    setOffers(((offs as any[]) || []).map((o) => ({ ...o, conditions: o.conditions || {} })) as Offer[]);
    setCoupons(((cps as any[]) || []) as Coupon[]);
  };
  useEffect(() => { fetchAll(); }, [workspaceId]);

  const removedKey = workspaceId ? `payments-removed-members-${workspaceId}` : null;
  useEffect(() => {
    if (!removedKey) return;
    try {
      const raw = localStorage.getItem(removedKey);
      setRemovedIds(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch { setRemovedIds(new Set()); }
  }, [removedKey]);

  const persistRemoved = (next: Set<string>) => {
    setRemovedIds(next);
    if (removedKey) {
      try { localStorage.setItem(removedKey, JSON.stringify([...next])); } catch { /* ignore */ }
    }
  };

  // A member reappears in Payments as soon as a new payment is recorded for them.
  useEffect(() => {
    if (removedIds.size === 0) return;
    const withPayments = new Set(payments.map((p) => p.student_id));
    const next = new Set([...removedIds].filter((id) => !withPayments.has(id)));
    if (next.size !== removedIds.size) persistRemoved(next);
  }, [payments]);



  // Realtime sync: reload when any shared table for this workspace changes.
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`payments-sync-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "student_payments", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "batches", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "offers", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);


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

  const [couponApplying, setCouponApplying] = useState(false);
  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) { toast.error("Enter a coupon code"); return; }
    if (!workspaceId) return;
    setCouponApplying(true);
    try {
      // Always validate against the database for the latest state.
      const { data: cRow, error: cErr } = await (supabase as any)
        .from("coupons")
        .select("*")
        .eq("user_id", workspaceId)
        .ilike("code", code)
        .maybeSingle();

      if (cErr || !cRow) { toast.error("Invalid coupon code"); return; }
      const c = cRow as Coupon;
      if (!c.is_active) { toast.error("This coupon is no longer active"); return; }
      if (c.usage_limit != null && c.usage_count >= c.usage_limit) {
        toast.error("Coupon usage limit reached"); return;
      }

      const { data: oRow, error: oErr } = await (supabase as any)
        .from("offers").select("*").eq("id", c.offer_id).maybeSingle();
      if (oErr || !oRow) { toast.error("Coupon's offer is not available"); return; }
      const offer = { ...oRow, conditions: oRow.conditions || {} } as Offer;

      if (!offer.is_active) { toast.error("This offer is no longer active"); return; }
      const today = form.paid_on;
      if (offer.valid_from && today < offer.valid_from) {
        toast.error(`Coupon is not yet active (starts ${offer.valid_from})`); return;
      }
      if (offer.valid_to && today > offer.valid_to) {
        toast.error("Coupon has expired"); return;
      }
      if (offer.usage_limit_total != null && offer.usage_count >= offer.usage_limit_total) {
        toast.error("Coupon usage limit reached"); return;
      }

      const amt = parseFloat(form.amount) || 0;
      if (!amt) { toast.error("Enter payment amount before applying a coupon"); return; }
      if (offer.min_payment_amount && amt < offer.min_payment_amount) {
        toast.error(`Minimum payment ₹${offer.min_payment_amount} required for this coupon`); return;
      }

      const cust = customers.find((cc) => cc.id === form.student_id);
      if (!cust) { toast.error("Select a member before applying a coupon"); return; }
      const ctx = { id: cust.id, batch_id: cust.batch_id };
      if (!isOfferEligible(offer, ctx as any, amt, form.paid_on)) {
        toast.error("Coupon is not eligible for this member"); return;
      }

      // Refresh in-memory offer list so downstream discount calc uses fresh data.
      setOffers((prev) => {
        const rest = prev.filter((o) => o.id !== offer.id);
        return [...rest, offer];
      });
      setAppliedCoupon(c);
      setSelectedOfferId(offer.id);
      toast.success(`Coupon applied — ₹${computeDiscount(offer, amt)} off`);
    } finally {
      setCouponApplying(false);
    }
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

  const visibleCustomers = useMemo(() => {
    if (!filterBatchId) return [];
    const base = customers.filter((c) => !removedIds.has(c.id));
    if (filterBatchId === "__all__") return base;
    if (filterBatchId === "__none__") return base.filter((c) => !c.batch_id);
    return base.filter((c) => c.batch_id === filterBatchId);
  }, [customers, filterBatchId, removedIds]);

  const selectedCustomer = customers.find((c) => c.id === form.student_id);
  const selectedBatchName = formBatchId
    ? (formBatchId === "__none__" ? "No Batch Assigned" : (batchMap.get(formBatchId) || "No Batch Assigned"))
    : "";

  // Members of the batch selected in the Record Payment form.
  const formBatchMembers = useMemo(() => {
    if (!formBatchId) return [];
    if (formBatchId === "__none__") return customers.filter((c) => !c.batch_id);
    return customers.filter((c) => c.batch_id === formBatchId);
  }, [customers, formBatchId]);

  // Choosing a batch resets the member and pre-fills the batch fee.
  const onFormBatchChange = (batchId: string) => {
    setFormBatchId(batchId);
    const fee = batches.find((b) => b.id === batchId)?.fee;
    setForm((f) => ({ ...f, student_id: "", amount: fee ? String(fee) : "" }));
    clearOffer();
  };

  // Selecting a member keeps the already-chosen batch and fills their last plan details.
  const onFormMemberChange = (studentId: string) => {
    const last = (payments.filter((p) => p.student_id === studentId)
      .sort((a, b) => (a.paid_on < b.paid_on ? 1 : -1)))[0];
    const fee = batches.find((b) => b.id === formBatchId)?.fee;
    setForm((f) => ({
      ...f,
      student_id: studentId,
      amount: f.amount || (last ? String(last.amount) : (fee ? String(fee) : "")),
      method: last?.method || f.method,
      durationUnit: ((last?.duration_unit as Unit) || (last?.duration_months ? "months" : f.durationUnit)) as Unit,
      durationValue: String(last?.duration_value ?? last?.duration_months ?? f.durationValue),
    }));
  };


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
    if (!workspaceId) return;
    const originalAmount = parseFloat(form.amount);
    if (!formBatchId) { toast.error("Select a batch first"); return; }
    if (!form.student_id) { toast.error("Pick a member"); return; }
    if (!originalAmount || originalAmount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!effectiveValue) { toast.error("Enter a valid duration"); return; }
    if (!renewalDate) { toast.error("Could not calculate renewal date"); return; }

    const payable = Math.max(0, originalAmount - discountAmount);

    const months_equiv =
      form.durationUnit === "months" ? effectiveValue :
      form.durationUnit === "years" ? effectiveValue * 12 :
      Math.max(1, Math.round(effectiveValue / 30));

    const { data: inserted, error } = await supabase.from("student_payments").insert({
      student_id: form.student_id,
      user_id: workspaceId,

      amount: payable,
      paid_on: form.paid_on,
      method: form.method,
      duration_value: effectiveValue,
      duration_unit: form.durationUnit,
      duration_months: months_equiv,
      valid_until: renewalDate,
      reminder_sent_at: null,
      applied_offer_id: selectedOffer?.id ?? null,
      applied_offer_name: selectedOffer?.name ?? null,
      applied_offer_type: selectedOffer?.offer_type ?? null,
      applied_coupon_code: appliedCoupon?.code ?? null,
      discount_amount: discountAmount,
    } as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    await logAudit(ownerId, "payment.created", { amount: payable, discount: discountAmount, offer: selectedOffer?.name, coupon: appliedCoupon?.code, duration_value: effectiveValue, duration_unit: form.durationUnit, valid_until: renewalDate }, { type: "student_payment", id: form.student_id });

    // Redemption audit + increment usage counters
    if (selectedOffer && inserted?.id) {
      await (supabase as any).from("offer_redemptions").insert({
        user_id: workspaceId,
        offer_id: selectedOffer.id,
        coupon_id: appliedCoupon?.id ?? null,
        student_id: form.student_id,
        payment_id: inserted.id,
        discount_amount: discountAmount,
      });
      await (supabase as any).from("offers").update({ usage_count: (selectedOffer.usage_count || 0) + 1 }).eq("id", selectedOffer.id);
      if (appliedCoupon) {
        await (supabase as any).from("coupons").update({ usage_count: (appliedCoupon.usage_count || 0) + 1 }).eq("id", appliedCoupon.id);
      }
    }

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
      amount: payable,
      originalAmount,
      discountAmount: discountAmount || undefined,
      offerName: selectedOffer?.name,
      offerCongrats: selectedOffer ? CONGRATS[selectedOffer.offer_type] : undefined,
      couponCode: appliedCoupon?.code,
      durationValue: effectiveValue,
      durationUnit: form.durationUnit,
      renewalDate,
      studioName: studioName || "Trinetra Yoga",
      studioAddress: studioAddress || undefined,
    });
    setReceiptOpen(true);

    setForm({ ...form, amount: "", durationValue: "1" });
    clearOffer();
    setAddOpen(false);
    fetchAll();
  };

  const deletePayment = async (id: string) => {
    await supabase.from("student_payments").delete().eq("id", id);
    await logAudit(ownerId, "payment.deleted", {}, { type: "student_payment", id });
    toast.success("Removed"); fetchAll();
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"export" | "only" | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const exportOnly = async (memberId: string, memberName: string) => {
    try {
      await exportMemberPayments(memberId, memberName);
      toast.success(`Exported payment records for ${memberName}`);
    } catch {
      toast.error("Export failed");
    }
  };

  const buildExportRows = (memberId: string) => {
    const rows = payments.filter((p) => p.student_id === memberId)
      .sort((a, b) => a.paid_on.localeCompare(b.paid_on));
    const header = ["Date", "Amount (Rs)", "Discount (Rs)", "Method", "Duration", "Valid Until", "Offer", "Coupon"];
    const body = rows.map((p) => [
      fmtDate(p.paid_on),
      String(Number(p.amount)),
      String(Number(p.discount_amount || 0)),
      p.method || "",
      p.duration_value && p.duration_unit ? `${p.duration_value} ${p.duration_unit}` : (p.duration_months ? `${p.duration_months} months` : ""),
      fmtDate(p.valid_until),
      p.applied_offer_name || "",
      p.applied_coupon_code || "",
    ]);
    const total = rows.reduce((s, p) => s + Number(p.amount), 0);
    return { header, body, total, count: rows.length };
  };

  const exportMemberPayments = async (memberId: string, memberName: string) => {
    const { header, body, total } = buildExportRows(memberId);
    const safeName = memberName.replace(/[^\w\-]+/g, "_");
    const stamp = fmtDateFile(new Date());
    const generatedOn = fmtDate(new Date());

    // CSV
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...body, ["Total", String(total), "", "", "", "", "", ""]]
      .map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${safeName}-payments-${stamp}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);

    // XLSX
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, ["Total", total]]);
    ws["!cols"] = header.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payments");
    XLSX.writeFile(wb, `${safeName}-payments-${stamp}.xlsx`);

    // PDF
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(`${studioName || "Trinetra Yoga"} — Payment History`, 40, 32);
    doc.setFontSize(11);
    doc.text(`Member: ${memberName}   |   Generated: ${generatedOn}   |   Total: Rs ${total.toLocaleString()}`, 40, 50);
    autoTable(doc, {
      head: [header], body, startY: 64,
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [34, 60, 55], textColor: 255 },
      margin: { left: 24, right: 24 },
    });
    doc.save(`${safeName}-payments-${stamp}.pdf`);
  };

  const runDeleteAll = async (withExport: boolean) => {
    if (!deleteTarget) return;
    const { id: memberId, name: memberName } = deleteTarget;
    setDeleting(true);
    try {
      if (withExport) {
        try {
          await exportMemberPayments(memberId, memberName);
        } catch (e: any) {
          toast.error("Export failed — deletion cancelled");
          setDeleting(false);
          return;
        }
      }
      const { error, count } = await supabase
        .from("student_payments")
        .delete({ count: "exact" })
        .eq("user_id", workspaceId)
        .eq("student_id", memberId);
      if (error) { toast.error(error.message); return; }
      // Remove the whole member entry from the Payments section view.
      const next = new Set(removedIds); next.add(memberId); persistRemoved(next);
      setExpanded((prev) => { const n = new Set(prev); n.delete(memberId); return n; });
      await logAudit(ownerId, "payment.bulk_deleted", { member_id: memberId, member_name: memberName, count: count ?? 0, exported: withExport, entry_removed: true }, { type: "student", id: memberId });
      toast.success(`${withExport ? "Exported and removed" : "Removed"} ${memberName} from Payments (${count ?? 0} record${count === 1 ? "" : "s"})`);
      setDeleteTarget(null);
      fetchAll();
    } finally {
      setDeleting(false);
    }
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
        <Dialog
          open={addOpen}
          onOpenChange={(o) => {
            setAddOpen(o);
            if (o && !formBatchId && filterBatchId && filterBatchId !== "__all__") {
              onFormBatchChange(filterBatchId);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Record Payment</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Record Payment</DialogTitle>
              <DialogDescription>Select a batch first, then the member. Renewal date is auto-calculated from duration.</DialogDescription>
            </DialogHeader>
            <form onSubmit={addPayment} className="space-y-4">
              <div className="space-y-2">
                <Label>Batch <span className="text-destructive">*</span></Label>
                <Select value={formBatchId} onValueChange={onFormBatchChange}>
                  <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    <SelectItem value="__none__">No Batch Assigned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Member <span className="text-destructive">*</span></Label>
                <Select value={form.student_id} onValueChange={onFormMemberChange} disabled={!formBatchId}>
                  <SelectTrigger><SelectValue placeholder={formBatchId ? "Select member" : "Select a batch first"} /></SelectTrigger>
                  <SelectContent>
                    {formBatchMembers.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">No members in this batch</div>
                    ) : formBatchMembers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formBatchId && (
                  <p className="text-xs text-muted-foreground">Batch: {selectedBatchName}</p>
                )}
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



              {/* Offers & Coupon */}
              <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4 text-primary" /> Offers &amp; Coupon
                </div>

                {eligibleOffers.length > 0 && !appliedCoupon && (
                  <div className="space-y-2">
                    <Label className="text-xs">Eligible offers</Label>
                    <div className="flex flex-wrap gap-2">
                      {eligibleOffers.map((o) => (
                        <button
                          type="button"
                          key={o.id}
                          onClick={() => setSelectedOfferId(selectedOfferId === o.id ? "" : o.id)}
                          className={`text-xs px-2 py-1 rounded-full border transition ${selectedOfferId === o.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                        >
                          {OFFER_LABELS[o.offer_type]} · {o.name} · ₹{o.discount_amount}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Coupon code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter coupon"
                      disabled={!!appliedCoupon}
                    />
                    {appliedCoupon ? (
                      <Button type="button" variant="outline" onClick={clearOffer}>Remove</Button>
                    ) : (
                      <Button type="button" variant="outline" onClick={applyCoupon} disabled={couponApplying || !couponInput.trim()}>{couponApplying ? "Checking…" : "Apply"}</Button>
                    )}
                  </div>
                </div>

                {selectedOffer && (
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300/50 p-2 text-xs">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-300">{CONGRATS[selectedOffer.offer_type]}</div>
                    <div className="text-emerald-800 dark:text-emerald-200 mt-1">
                      {selectedOffer.name}
                      {appliedCoupon && <> · <code>{appliedCoupon.code}</code></>}
                      <Badge variant="secondary" className="ml-2">−₹{discountAmount}</Badge>
                    </div>
                  </div>
                )}

                {form.amount && (
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Payable</span>
                    <span className="font-semibold">₹{finalAmount.toLocaleString()}</span>
                  </div>
                )}
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

      {/* Batch filter */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Label className="text-sm font-medium shrink-0">Filter by Batch</Label>
          <Select value={filterBatchId} onValueChange={setFilterBatchId}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue placeholder="Select a batch to view payments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Batches</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
              <SelectItem value="__none__">No Batch Assigned</SelectItem>
            </SelectContent>
          </Select>
          {filterBatchId && (
            <span className="text-xs text-muted-foreground ml-auto">
              {visibleCustomers.length} member{visibleCustomers.length === 1 ? "" : "s"}
            </span>
          )}
        </CardContent>
      </Card>

      {customers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Add customers first to record payments.</CardContent></Card>
      ) : !filterBatchId ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Select a batch above to view payment records.</CardContent></Card>
      ) : visibleCustomers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No members in this batch.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {visibleCustomers.map((c) => {
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
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {c.batch_id ? (batchMap.get(c.batch_id) || "No Batch Assigned") : "No Batch Assigned"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{list.length} payment{list.length === 1 ? "" : "s"}</span>
                        </div>
                      </div>

                    </div>
                    <span className="font-display font-bold text-lg shrink-0">₹{total.toLocaleString()}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border">
                      {list.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground italic text-center">No payments yet.</p>
                      ) : (
                        <>
                        <div className="flex justify-end p-2 px-4 bg-muted/30">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: c.id, name: c.name }); }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 px-2.5 py-1.5 rounded-md"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete All Payments
                          </button>
                        </div>
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
                                  Paid {fmtDate(p.paid_on)}
                                  {p.valid_until ? ` · renews ${fmtDate(p.valid_until)}` : ""}
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
                                      originalAmount: Number(p.amount) + Number(p.discount_amount || 0),
                                      discountAmount: p.discount_amount ? Number(p.discount_amount) : undefined,
                                      offerName: p.applied_offer_name || undefined,
                                      offerCongrats: p.applied_offer_type ? CONGRATS[p.applied_offer_type as keyof typeof CONGRATS] : undefined,
                                      couponCode: p.applied_coupon_code || undefined,
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
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete member entry from Payments</DialogTitle>
            <DialogDescription>
              This permanently deletes all payment records and receipts for {deleteTarget?.name} and removes their entry from the Payments list. This action cannot be undone. The member profile and all other modules stay untouched.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {deleteTarget ? `${buildExportRows(deleteTarget.id).count} payment record(s) will be removed.` : null}
          </div>
          <div className="flex flex-col gap-2">
            <Button disabled={deleting} onClick={() => runDeleteAll(true)}>
              <FileText className="h-4 w-4 mr-2" /> Export & Delete (PDF + Excel)
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => runDeleteAll(false)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Only
            </Button>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
      <PaymentReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />

    </div>
  );
};

export default Payments;
