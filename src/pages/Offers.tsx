import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Ticket, Send, Copy, Gift } from "lucide-react";
import { toast } from "sonner";
import { Offer, OfferType, Coupon, OFFER_LABELS, CONGRATS, waLink } from "@/lib/offers";

const OFFER_TYPES: { value: OfferType; label: string }[] = [
  { value: "birthday", label: "🎂 Birthday" },
  { value: "festival", label: "🎊 Festival" },
  { value: "new_year", label: "🎆 New Year" },
  { value: "annual", label: "🎉 Annual" },
  { value: "custom", label: "✨ Custom" },
];

const emptyForm = {
  name: "",
  offer_type: "custom" as OfferType,
  message: "",
  discount_amount: "",
  min_payment_amount: "",
  valid_from: "",
  valid_to: "",
  usage_limit_total: "",
  usage_limit_per_member: "",
  is_active: true,
  cond_membership_days: "",
  cond_membership_type: "",
  cond_batch_ids: [] as string[],
  cond_member_ids: [] as string[],
  cond_payment_status: "any" as "any" | "paid" | "overdue",
  cond_requires_active: false,
  cond_custom_rule: "",
  coupon_code: "",
  coupon_limit: "",
};

const Offers = () => {
  const { user } = useAuth();
  const { ownerId } = useStudio();
  const workspaceId = ownerId ?? user?.id ?? null;
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string; phone: string | null; batch_id: string | null }[]>([]);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Offer | null>(null);
  const [sendOpen, setSendOpen] = useState<Offer | null>(null);
  const [sendMode, setSendMode] = useState<"all" | "batch" | "selected">("all");
  const [sendBatch, setSendBatch] = useState<string>("");
  const [sendMemberIds, setSendMemberIds] = useState<string[]>([]);

  const fetchAll = async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [{ data: offs }, { data: cps }, { data: mem }, { data: bat }] = await Promise.all([
      (supabase as any).from("offers").select("*").eq("user_id", workspaceId).order("created_at", { ascending: false }),
      (supabase as any).from("coupons").select("*").eq("user_id", workspaceId),
      supabase.from("students").select("id,name,phone,batch_id").eq("user_id", workspaceId).order("name"),
      supabase.from("batches").select("id,name").eq("user_id", workspaceId).order("name"),
    ]);
    setOffers(((offs as any[]) || []).map((o) => ({ ...o, conditions: o.conditions || {} })) as Offer[]);
    setCoupons(((cps as any[]) || []) as Coupon[]);
    setMembers((mem as any[]) || []);
    setBatches((bat as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, [workspaceId]);

  // Realtime sync across owner and staff on the same workspace.
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`offers-sync-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "offers", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "coupons", filter: `user_id=eq.${workspaceId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);


  const couponsByOffer = useMemo(() => {
    const m = new Map<string, Coupon[]>();
    coupons.forEach((c) => {
      if (!m.has(c.offer_id)) m.set(c.offer_id, []);
      m.get(c.offer_id)!.push(c);
    });
    return m;
  }, [coupons]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (o: Offer) => {
    setEditing(o);
    setForm({
      name: o.name,
      offer_type: o.offer_type,
      message: o.message ?? "",
      discount_amount: String(o.discount_amount ?? ""),
      min_payment_amount: String(o.min_payment_amount ?? ""),
      valid_from: o.valid_from ?? "",
      valid_to: o.valid_to ?? "",
      usage_limit_total: o.usage_limit_total?.toString() ?? "",
      usage_limit_per_member: o.usage_limit_per_member?.toString() ?? "",
      is_active: o.is_active,
      cond_membership_days: o.conditions.membership_duration_min_days?.toString() ?? "",
      cond_membership_type: o.conditions.membership_type ?? "",
      cond_batch_ids: o.conditions.batch_ids ?? [],
      cond_member_ids: o.conditions.member_ids ?? [],
      cond_payment_status: (o.conditions.payment_status ?? "any") as any,
      cond_requires_active: !!o.conditions.requires_active_membership,
      cond_custom_rule: o.conditions.custom_rule ?? "",
      coupon_code: "",
      coupon_limit: "",
    });
    setDialogOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) { toast.error("Offer name is required"); return; }
    const discount = parseFloat(form.discount_amount);
    if (!discount || discount <= 0) { toast.error("Enter a valid discount amount"); return; }

    const conditions = {
      membership_duration_min_days: form.cond_membership_days ? parseInt(form.cond_membership_days) : null,
      membership_type: form.cond_membership_type.trim() || null,
      batch_ids: form.cond_batch_ids.length ? form.cond_batch_ids : null,
      member_ids: form.cond_member_ids.length ? form.cond_member_ids : null,
      payment_status: form.cond_payment_status,
      requires_active_membership: form.cond_requires_active,
      custom_rule: form.cond_custom_rule.trim() || null,
    };
    const payload: any = {
      user_id: user.id,
      name: form.name.trim(),
      offer_type: form.offer_type,
      message: form.message.trim() || null,
      discount_amount: discount,
      min_payment_amount: parseFloat(form.min_payment_amount || "0") || 0,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      usage_limit_total: form.usage_limit_total ? parseInt(form.usage_limit_total) : null,
      usage_limit_per_member: form.usage_limit_per_member ? parseInt(form.usage_limit_per_member) : null,
      is_active: form.is_active,
      conditions,
    };

    let offerId = editing?.id;
    if (editing) {
      const { error } = await (supabase as any).from("offers").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await (supabase as any).from("offers").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      offerId = data.id;
    }

    // Optional inline coupon on create
    if (offerId && form.coupon_code.trim()) {
      const code = form.coupon_code.trim().toUpperCase();
      const { error: ce } = await (supabase as any).from("coupons").insert({
        user_id: user.id,
        offer_id: offerId,
        code,
        usage_limit: form.coupon_limit ? parseInt(form.coupon_limit) : null,
        is_active: true,
      });
      if (ce) toast.error(`Coupon: ${ce.message}`);
    }

    toast.success(editing ? "Offer updated" : "Offer created");
    setDialogOpen(false);
    fetchAll();
  };

  const toggleActive = async (o: Offer) => {
    const { error } = await (supabase as any).from("offers").update({ is_active: !o.is_active }).eq("id", o.id);
    if (error) return toast.error(error.message);
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await (supabase as any).from("offers").delete().eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Offer deleted");
    setDeleteTarget(null);
    fetchAll();
  };

  const addCoupon = async (offer: Offer) => {
    const code = window.prompt("Coupon code (letters/numbers)")?.trim().toUpperCase();
    if (!code) return;
    const { error } = await (supabase as any).from("coupons").insert({
      user_id: user!.id, offer_id: offer.id, code, is_active: true,
    });
    if (error) return toast.error(error.code === "23505" ? "That code already exists" : error.message);
    toast.success("Coupon added");
    fetchAll();
  };

  const deleteCoupon = async (c: Coupon) => {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return;
    await (supabase as any).from("coupons").delete().eq("id", c.id);
    fetchAll();
  };

  const sendWhatsApp = () => {
    if (!sendOpen) return;
    let targets: { name: string; phone: string | null }[] = [];
    if (sendMode === "all") targets = members;
    else if (sendMode === "batch") targets = members.filter((m) => m.batch_id === sendBatch);
    else targets = members.filter((m) => sendMemberIds.includes(m.id));

    const withPhone = targets.filter((t) => t.phone);
    if (withPhone.length === 0) { toast.error("No recipients with phone numbers"); return; }

    const firstCoupon = couponsByOffer.get(sendOpen.id)?.[0];
    const lines = [
      CONGRATS[sendOpen.offer_type],
      "",
      sendOpen.message || sendOpen.name,
      `Discount: ₹${sendOpen.discount_amount}`,
      firstCoupon ? `Coupon Code: ${firstCoupon.code}` : "",
      sendOpen.valid_to ? `Valid until ${sendOpen.valid_to}` : "",
    ].filter(Boolean).join("\n");

    withPhone.slice(0, 25).forEach((t, i) => {
      setTimeout(() => window.open(waLink(t.phone, lines), "_blank"), i * 250);
    });
    toast.success(`Opening WhatsApp for ${withPhone.length} recipient(s)`);
    setSendOpen(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Gift className="h-7 w-7 text-primary" />
            Offers &amp; Coupons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create discounts, coupon codes, and share them with members.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Offer</Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading offers…</CardContent></Card>
      ) : offers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          No offers yet. Create your first offer to reward members.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {offers.map((o) => {
            const cs = couponsByOffer.get(o.id) || [];
            return (
              <Card key={o.id} className={o.is_active ? "" : "opacity-60"}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg font-semibold truncate">{o.name}</h3>
                        <Badge variant="secondary">{OFFER_LABELS[o.offer_type]}</Badge>
                        {!o.is_active && <Badge variant="outline">Paused</Badge>}
                      </div>
                      {o.message && <p className="text-sm text-muted-foreground mt-1">{o.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        ₹{o.discount_amount} off
                        {o.min_payment_amount ? ` · min ₹${o.min_payment_amount}` : ""}
                        {o.valid_from || o.valid_to ? ` · ${o.valid_from ?? "…"} → ${o.valid_to ?? "…"}` : ""}
                        {o.usage_limit_total ? ` · ${o.usage_count}/${o.usage_limit_total} used` : ` · ${o.usage_count} used`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Switch checked={o.is_active} onCheckedChange={() => toggleActive(o)} />
                      <Button size="icon" variant="ghost" onClick={() => setSendOpen(o)} title="Send via WhatsApp"><Send className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(o)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(o)} title="Delete" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Ticket className="h-3 w-3" />Coupons:</span>
                    {cs.map((c) => (
                      <div key={c.id} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                        <code className="font-mono">{c.code}</code>
                        <button title="Copy" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }}><Copy className="h-3 w-3 opacity-60" /></button>
                        <button title="Delete" onClick={() => deleteCoupon(c)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addCoupon(o)}><Plus className="h-3 w-3 mr-1" />Add code</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit Offer" : "New Offer"}</DialogTitle>
            <DialogDescription>Discounts are fixed amount in ₹. Coupons are optional.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Offer Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer Special" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.offer_type} onValueChange={(v) => setForm({ ...form, offer_type: v as OfferType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Amount (₹)</Label>
                <Input type="number" min="1" step="1" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Message to members</Label>
                <Textarea rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Enjoy ₹200 off on your next renewal" />
              </div>
              <div className="space-y-2">
                <Label>Min Payment (₹)</Label>
                <Input type="number" min="0" step="1" value={form.min_payment_amount} onChange={(e) => setForm({ ...form, min_payment_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Total usage limit</Label>
                <Input type="number" min="0" step="1" value={form.usage_limit_total} onChange={(e) => setForm({ ...form, usage_limit_total: e.target.value })} placeholder="Unlimited" />
              </div>
              <div className="space-y-2">
                <Label>Per-member limit</Label>
                <Input type="number" min="0" step="1" value={form.usage_limit_per_member} onChange={(e) => setForm({ ...form, usage_limit_per_member: e.target.value })} placeholder="Unlimited" />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="text-sm font-semibold">Conditions</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Membership min (days)</Label>
                  <Input type="number" min="0" value={form.cond_membership_days} onChange={(e) => setForm({ ...form, cond_membership_days: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Membership type</Label>
                  <Input value={form.cond_membership_type} onChange={(e) => setForm({ ...form, cond_membership_type: e.target.value })} placeholder="Any" />
                </div>
                <div className="space-y-2">
                  <Label>Batch</Label>
                  <Select value={form.cond_batch_ids[0] ?? "any"} onValueChange={(v) => setForm({ ...form, cond_batch_ids: v === "any" ? [] : [v] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any batch</SelectItem>
                      {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment status</Label>
                  <Select value={form.cond_payment_status} onValueChange={(v) => setForm({ ...form, cond_payment_status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Switch checked={form.cond_requires_active} onCheckedChange={(v) => setForm({ ...form, cond_requires_active: v })} />
                  <Label className="!m-0">Requires active membership</Label>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Custom rule (free text)</Label>
                  <Input value={form.cond_custom_rule} onChange={(e) => setForm({ ...form, cond_custom_rule: e.target.value })} placeholder="Optional notes for staff" />
                </div>
              </div>
            </div>

            {!editing && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="text-sm font-semibold">Coupon (optional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Coupon code</Label>
                    <Input value={form.coupon_code} onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} placeholder="SUMMER25" />
                  </div>
                  <div className="space-y-2">
                    <Label>Uses limit</Label>
                    <Input type="number" min="0" value={form.coupon_limit} onChange={(e) => setForm({ ...form, coupon_limit: e.target.value })} placeholder="Unlimited" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="!m-0">Active</Label>
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">{editing ? "Update Offer" : "Create Offer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Send via WhatsApp */}
      <Dialog open={!!sendOpen} onOpenChange={(v) => !v && setSendOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Send via WhatsApp</DialogTitle>
            <DialogDescription>Opens WhatsApp with the offer message pre-filled for each recipient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={sendMode} onValueChange={(v) => setSendMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                <SelectItem value="batch">Specific Batch</SelectItem>
                <SelectItem value="selected">Selected Members</SelectItem>
              </SelectContent>
            </Select>

            {sendMode === "batch" && (
              <Select value={sendBatch} onValueChange={setSendBatch}>
                <SelectTrigger><SelectValue placeholder="Pick a batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {sendMode === "selected" && (
              <div className="max-h-56 overflow-y-auto rounded-md border p-2 space-y-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm py-1">
                    <input
                      type="checkbox"
                      checked={sendMemberIds.includes(m.id)}
                      onChange={(e) => setSendMemberIds((s) => e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id))}
                    />
                    <span className="truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{m.phone || "no phone"}</span>
                  </label>
                ))}
              </div>
            )}

            <Button className="w-full" onClick={sendWhatsApp}><Send className="h-4 w-4 mr-2" />Send</Button>
            <p className="text-[11px] text-muted-foreground text-center">Note: Cloud API bulk-send can be enabled later.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); confirmDelete(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Offers;
