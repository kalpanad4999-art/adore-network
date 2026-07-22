import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Layers, UserPlus, QrCode, Copy, ArrowRightLeft, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { format } from "date-fns";
import CustomerDetailsTable from "@/components/CustomerDetailsTable";


interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  batch_id: string | null;
  custom_data: Record<string, string> | null;
}

interface CustomField { id: string; name: string; required: boolean; enabled: boolean; }

interface Batch {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  fee: number;
  public_token: string;
  required_fields: string[];
  custom_fields: CustomField[];
}

const FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "notes", label: "Notes" },
  { key: "height", label: "Height (cm)" },
  { key: "weight", label: "Weight (kg)" },
];

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

const Customers = () => {
  const { user } = useAuth();
  const { isOwner, ownerId } = useStudio();
  const workspaceId = ownerId ?? user?.id ?? null;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch dialog
  const [batchOpen, setBatchOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState<{ name: string; description: string; start_date: string; fee: string; required_fields: string[]; custom_fields: CustomField[] }>({ name: "", description: "", start_date: "", fee: "", required_fields: ["name"], custom_fields: [] });

  // Customer dialog
  const [custOpen, setCustOpen] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [custForm, setCustForm] = useState({ name: "", email: "", phone: "", address: "", notes: "", height: "", weight: "" });
  const [custCustom, setCustCustom] = useState<Record<string, string>>({});

  // QR dialog
  const [qrBatch, setQrBatch] = useState<Batch | null>(null);

  const fetchCustomers = async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from("students").select("id,name,email,phone,address,notes,height_cm,weight_kg,batch_id,custom_data").eq("user_id", workspaceId).order("name");
    const rows = (data || []).map((c: any) => ({ ...c, custom_data: (c.custom_data && typeof c.custom_data === "object") ? c.custom_data : {} })) as Customer[];
    setCustomers(rows);
  };
  const fetchBatches = async () => {
    if (!workspaceId) return;
    const { data } = await supabase.from("batches").select("*").eq("user_id", workspaceId).order("created_at", { ascending: false });
    const rows = (data || []).map((b: any) => ({ ...b, custom_fields: Array.isArray(b.custom_fields) ? b.custom_fields : [] })) as Batch[];
    setBatches(rows);
  };
  useEffect(() => { fetchCustomers(); fetchBatches(); }, [workspaceId]);

  // Realtime sync across all authorized users on the same workspace.
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`customers-sync-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${workspaceId}` }, () => fetchCustomers())
      .on("postgres_changes", { event: "*", schema: "public", table: "batches", filter: `user_id=eq.${workspaceId}` }, () => fetchBatches())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId]);


  const customersByBatch = useMemo(() => {
    const m = new Map<string, Customer[]>();
    customers.forEach((c) => {
      if (!c.batch_id) return;
      if (!m.has(c.batch_id)) m.set(c.batch_id, []);
      m.get(c.batch_id)!.push(c);
    });
    return m;
  }, [customers]);

  // ---------- Batch CRUD ----------
  const submitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    const name = batchForm.name.trim();
    if (!name) { toast.error("Name required"); return; }
    const required_fields = Array.from(new Set(["name", ...batchForm.required_fields]));
    const cleaned_custom = batchForm.custom_fields
      .map((f) => ({ ...f, name: f.name.trim() }))
      .filter((f) => f.name.length > 0);
    if (cleaned_custom.some((f) => f.name.length > 60)) { toast.error("Custom field names must be 60 characters or less"); return; }
    const payload = {
      user_id: workspaceId,

      name,
      description: batchForm.description.trim() || null,
      start_date: batchForm.start_date || null,
      fee: batchForm.fee ? Number(batchForm.fee) : 0,
      required_fields,
      custom_fields: cleaned_custom as any,
    };
    const { error } = editingBatchId
      ? await supabase.from("batches").update(payload).eq("id", editingBatchId)
      : await supabase.from("batches").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingBatchId ? "Batch updated" : "Batch added");
    resetBatchForm(); fetchBatches();
  };

  const editBatch = (b: Batch) => {
    setEditingBatchId(b.id);
    setBatchForm({
      name: b.name, description: b.description || "", start_date: b.start_date || "",
      fee: b.fee?.toString() || "", required_fields: b.required_fields?.length ? b.required_fields : ["name"],
      custom_fields: Array.isArray(b.custom_fields) ? b.custom_fields : [],
    });
    setBatchOpen(true);
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Delete this batch? Members will be unassigned.")) return;
    await supabase.from("batches").delete().eq("id", id);
    toast.success("Batch removed"); fetchBatches(); fetchCustomers();
  };

  const resetBatchForm = () => {
    setBatchForm({ name: "", description: "", start_date: "", fee: "", required_fields: ["name"], custom_fields: [] });
    setEditingBatchId(null); setBatchOpen(false);
  };

  const toggleRequiredField = (key: string) => {
    if (key === "name") return;
    setBatchForm((prev) => ({
      ...prev,
      required_fields: prev.required_fields.includes(key)
        ? prev.required_fields.filter((k) => k !== key)
        : [...prev.required_fields, key],
    }));
  };

  const addCustomField = () => {
    setBatchForm((prev) => ({
      ...prev,
      custom_fields: [...prev.custom_fields, { id: crypto.randomUUID(), name: "", required: false, enabled: true }],
    }));
  };
  const updateCustomField = (id: string, patch: Partial<CustomField>) => {
    setBatchForm((prev) => ({ ...prev, custom_fields: prev.custom_fields.map((f) => f.id === id ? { ...f, ...patch } : f) }));
  };
  const removeCustomField = (id: string) => {
    setBatchForm((prev) => ({ ...prev, custom_fields: prev.custom_fields.filter((f) => f.id !== id) }));
  };

  // ---------- Customer CRUD ----------
  const openAddCustomer = (batchId: string) => {
    setEditingCustId(null);
    setActiveBatchId(batchId);
    setCustForm({ name: "", email: "", phone: "", address: "", notes: "", height: "", weight: "" });
    setCustCustom({});
    setCustOpen(true);
  };

  const editCustomer = (c: Customer) => {
    setEditingCustId(c.id);
    setActiveBatchId(c.batch_id);
    setCustForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", notes: c.notes || "", height: c.height_cm?.toString() || "", weight: c.weight_kg?.toString() || "" });
    setCustCustom((c.custom_data && typeof c.custom_data === "object") ? { ...c.custom_data } : {});
    setCustOpen(true);
  };

  const submitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !activeBatchId) return;
    if (custForm.phone && !phoneRegex.test(custForm.phone.trim())) { toast.error("Enter a valid phone"); return; }
    const heightNum = custForm.height ? Number(custForm.height) : null;
    const weightNum = custForm.weight ? Number(custForm.weight) : null;
    if (heightNum !== null && (Number.isNaN(heightNum) || heightNum < 30 || heightNum > 272)) { toast.error("Enter a valid height in cm"); return; }
    if (weightNum !== null && (Number.isNaN(weightNum) || weightNum < 2 || weightNum > 500)) { toast.error("Enter a valid weight in kg"); return; }
    const activeBatch = batches.find((b) => b.id === activeBatchId);
    const activeCustomFields = (activeBatch?.custom_fields || []).filter((f) => f.enabled !== false);
    const customDataClean: Record<string, string> = {};
    for (const f of activeCustomFields) {
      const v = (custCustom[f.id] || "").trim();
      if (f.required && !v) { toast.error(`${f.name} is required`); return; }
      if (v) customDataClean[f.id] = v.slice(0, 500);
    }
    const payload = {
      user_id: workspaceId,

      batch_id: activeBatchId,
      name: custForm.name.trim(),
      email: custForm.email.trim() || null,
      phone: custForm.phone.trim() || null,
      address: custForm.address.trim() || null,
      notes: custForm.notes.trim() || null,
      height_cm: heightNum,
      weight_kg: weightNum,
      custom_data: customDataClean as any,
    };
    const { error } = editingCustId
      ? await supabase.from("students").update(payload).eq("id", editingCustId)
      : await supabase.from("students").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingCustId ? "Member updated" : "Member added");
    setCustOpen(false); setEditingCustId(null); setActiveBatchId(null); setCustCustom({});
    fetchCustomers();
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    try {
      // Cascade delete related records first (no FK cascade in schema).
      const { error: payErr } = await supabase.from("student_payments").delete().eq("student_id", deleteTarget.id);
      if (payErr) throw payErr;
      const { error: custErr } = await supabase.from("students").delete().eq("id", deleteTarget.id);
      if (custErr) throw custErr;
      toast.success("Member deleted successfully.");
      setDeleteTarget(null);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete customer");
    } finally {
      setDeleting(false);
    }
  };

  const moveCustomer = async (customerId: string, targetBatchId: string) => {
    const { error } = await supabase.from("students").update({ batch_id: targetBatchId }).eq("id", customerId);
    if (error) { toast.error(error.message); return; }
    toast.success("Member moved");
    fetchCustomers();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-3xl font-bold">Members</h1>
        <Dialog open={batchOpen} onOpenChange={(v) => { if (!v) resetBatchForm(); else setBatchOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Batch</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingBatchId ? "Edit" : "Add"} Batch</DialogTitle>
              <DialogDescription>Batch details (owner-only).</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitBatch} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} maxLength={80} required /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={batchForm.description} onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })} maxLength={500} rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start date</Label><Input type="date" value={batchForm.start_date} onChange={(e) => setBatchForm({ ...batchForm, start_date: e.target.value })} /></div>
                <div className="space-y-2"><Label>Fee (₹)</Label><Input type="number" min="0" step="0.01" value={batchForm.fee} onChange={(e) => setBatchForm({ ...batchForm, fee: e.target.value })} /></div>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-sm font-medium">Required fields on registration form</Label>
                <p className="text-xs text-muted-foreground">Choose which details students must fill before joining via the QR scanner.</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {FIELD_OPTIONS.map((f) => {
                    const checked = batchForm.required_fields.includes(f.key);
                    const locked = f.key === "name";
                    return (
                      <label key={f.key} className={`flex items-center gap-2 text-sm ${locked ? "opacity-70" : "cursor-pointer"}`}>
                        <Checkbox checked={checked} disabled={locked} onCheckedChange={() => toggleRequiredField(f.key)} />
                        <span>{f.label}{locked ? " (always)" : ""}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div>
                  <Label className="text-sm font-medium">Other (Custom Fields)</Label>
                  <p className="text-xs text-muted-foreground">Add your own questions like Emergency Contact, Blood Group, Occupation, etc.</p>
                </div>
                {batchForm.custom_fields.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">No custom fields yet.</p>
                ) : (
                  <div className="space-y-2">
                    {batchForm.custom_fields.map((cf) => (
                      <div key={cf.id} className="rounded-md border bg-muted/30 p-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={cf.name}
                            onChange={(e) => updateCustomField(cf.id, { name: e.target.value })}
                            placeholder="Enter custom field name"
                            maxLength={60}
                            className="flex-1 h-9"
                          />
                          <button type="button" onClick={() => removeCustomField(cf.id)} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete field">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Switch checked={cf.required} onCheckedChange={(v) => updateCustomField(cf.id, { required: !!v })} />
                            <span>Required</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Switch checked={cf.enabled} onCheckedChange={(v) => updateCustomField(cf.id, { enabled: !!v })} />
                            <span>Enabled</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addCustomField}>
                  <Plus className="h-4 w-4 mr-2" />Add Custom Field
                </Button>
              </div>

              <Button type="submit" className="w-full">{editingBatchId ? "Update" : "Add"} Batch</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {batches.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No batches yet. Add one to start adding customers.</CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {batches.map((b) => {
            const members = customersByBatch.get(b.id) || [];
            return (
              <AccordionItem key={b.id} value={b.id} className="border rounded-lg bg-card px-4">
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 hover:no-underline py-4">
                    <div className="flex items-center gap-3 text-left flex-1 min-w-0">
                      <Layers className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{b.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{members.length} {members.length === 1 ? "member" : "members"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap font-normal">
                          {b.start_date && <span>Starts {format(new Date(b.start_date), "PP")}</span>}
                          <span>Fee ₹{Number(b.fee).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); setQrBatch(b); }} className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10" title="QR scanner"><QrCode className="h-4 w-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); editBatch(b); }} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                    <button onClick={(e) => { e.stopPropagation(); deleteBatch(b.id); }} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <AccordionContent className="pb-4 space-y-3">
                  {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setQrBatch(b)}>
                      <QrCode className="h-4 w-4 mr-2" />Show QR
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAddCustomer(b.id)}>
                      <UserPlus className="h-4 w-4 mr-2" />Add Member
                    </Button>
                  </div>
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4">No customers in this batch yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {members.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/40 border border-border">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{c.name}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {c.phone || "—"}{c.email ? ` · ${c.email}` : ""}
                            </p>
                            {(c.height_cm || c.weight_kg) && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.height_cm ? `${c.height_cm} cm` : ""}{c.height_cm && c.weight_kg ? " · " : ""}{c.weight_kg ? `${c.weight_kg} kg` : ""}
                              </p>
                            )}
                            {c.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</p>}
                            {b.custom_fields?.filter((f) => f.enabled !== false).map((f) => {
                              const v = c.custom_data?.[f.id];
                              if (!v) return null;
                              return <p key={f.id} className="text-xs text-muted-foreground mt-0.5 truncate"><span className="font-medium text-foreground/80">{f.name}:</span> {v}</p>;
                            })}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button title="Move to another batch" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><ArrowRightLeft className="h-4 w-4" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Move to batch</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {batches.filter((tb) => tb.id !== c.batch_id).length === 0 ? (
                                  <DropdownMenuItem disabled>No other batches</DropdownMenuItem>
                                ) : (
                                  batches.filter((tb) => tb.id !== c.batch_id).map((tb) => (
                                    <DropdownMenuItem key={tb.id} onClick={() => moveCustomer(c.id, tb.id)}>{tb.name}</DropdownMenuItem>
                                  ))
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <button onClick={() => editCustomer(c)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                            {isOwner && (
                              <button onClick={() => setDeleteTarget(c)} title="Delete customer" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Customer dialog */}
      <Dialog open={custOpen} onOpenChange={(v) => { if (!v) { setCustOpen(false); setEditingCustId(null); setActiveBatchId(null); setCustCustom({}); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingCustId ? "Edit" : "Add"} Customer</DialogTitle>
            <DialogDescription>{batches.find((b) => b.id === activeBatchId)?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCustomer} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} maxLength={100} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} maxLength={255} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} maxLength={20} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Height (cm)</Label><Input type="number" inputMode="decimal" min={30} max={272} step="0.1" value={custForm.height} onChange={(e) => setCustForm({ ...custForm, height: e.target.value })} /></div>
              <div className="space-y-2"><Label>Weight (kg)</Label><Input type="number" inputMode="decimal" min={2} max={500} step="0.1" value={custForm.weight} onChange={(e) => setCustForm({ ...custForm, weight: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} maxLength={300} rows={2} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={custForm.notes} onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })} maxLength={1000} /></div>
            {batches.find((b) => b.id === activeBatchId)?.custom_fields?.filter((f) => f.enabled !== false).map((f) => (
              <div key={f.id} className="space-y-2">
                <Label>{f.name} {f.required && <span className="text-destructive">*</span>}</Label>
                <Input
                  value={custCustom[f.id] || ""}
                  onChange={(e) => setCustCustom((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  maxLength={500}
                  required={f.required}
                />
              </div>
            ))}
            <Button type="submit" className="w-full">{editingCustId ? "Update" : "Add"} Customer</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrBatch} onOpenChange={(v) => { if (!v) setQrBatch(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{qrBatch?.name} — Registration QR</DialogTitle>
            <DialogDescription>Members scan this to fill in their details.</DialogDescription>
          </DialogHeader>
          {qrBatch && (() => {
            const url = `${window.location.origin}/join/${qrBatch.public_token}`;
            return (
              <div className="space-y-4">
                <div className="flex justify-center bg-white p-4 rounded-md">
                  <QRCodeSVG value={url} size={220} level="M" />
                </div>
                <div className="flex items-center gap-2">
                  <Input value={url} readOnly className="text-xs" />
                  <Button type="button" size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete customer confirmation (owner-only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); confirmDeleteCustomer(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Customers;
