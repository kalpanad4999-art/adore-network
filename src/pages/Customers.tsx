import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Pencil, Trash2, Layers, UserPlus, QrCode, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { format } from "date-fns";

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
}

interface Batch {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  fee: number;
  public_token: string;
}

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

const Customers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Batch dialog
  const [batchOpen, setBatchOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({ name: "", description: "", start_date: "", fee: "" });

  // Customer dialog
  const [custOpen, setCustOpen] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [custForm, setCustForm] = useState({ name: "", email: "", phone: "", address: "", notes: "", height: "", weight: "" });

  // QR dialog
  const [qrBatch, setQrBatch] = useState<Batch | null>(null);

  const fetchCustomers = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("id,name,email,phone,address,notes,height_cm,weight_kg,batch_id").eq("user_id", user.id).order("name");
    setCustomers((data as Customer[]) || []);
  };
  const fetchBatches = async () => {
    if (!user) return;
    const { data } = await supabase.from("batches").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setBatches((data as Batch[]) || []);
  };
  useEffect(() => { fetchCustomers(); fetchBatches(); }, [user]);

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
    if (!user) return;
    const name = batchForm.name.trim();
    if (!name) { toast.error("Name required"); return; }
    const payload = {
      user_id: user.id,
      name,
      description: batchForm.description.trim() || null,
      start_date: batchForm.start_date || null,
      fee: batchForm.fee ? Number(batchForm.fee) : 0,
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
    setBatchForm({ name: b.name, description: b.description || "", start_date: b.start_date || "", fee: b.fee?.toString() || "" });
    setBatchOpen(true);
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Delete this batch? Members will be unassigned.")) return;
    await supabase.from("batches").delete().eq("id", id);
    toast.success("Batch removed"); fetchBatches(); fetchCustomers();
  };

  const resetBatchForm = () => {
    setBatchForm({ name: "", description: "", start_date: "", fee: "" });
    setEditingBatchId(null); setBatchOpen(false);
  };

  // ---------- Customer CRUD ----------
  const openAddCustomer = (batchId: string) => {
    setEditingCustId(null);
    setActiveBatchId(batchId);
    setCustForm({ name: "", email: "", phone: "", address: "", notes: "" });
    setCustOpen(true);
  };

  const editCustomer = (c: Customer) => {
    setEditingCustId(c.id);
    setActiveBatchId(c.batch_id);
    setCustForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", notes: c.notes || "" });
    setCustOpen(true);
  };

  const submitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeBatchId) return;
    if (custForm.phone && !phoneRegex.test(custForm.phone.trim())) { toast.error("Enter a valid phone"); return; }
    const payload = {
      user_id: user.id,
      batch_id: activeBatchId,
      name: custForm.name.trim(),
      email: custForm.email.trim() || null,
      phone: custForm.phone.trim() || null,
      address: custForm.address.trim() || null,
      notes: custForm.notes.trim() || null,
    };
    const { error } = editingCustId
      ? await supabase.from("students").update(payload).eq("id", editingCustId)
      : await supabase.from("students").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingCustId ? "Customer updated" : "Customer added");
    setCustOpen(false); setEditingCustId(null); setActiveBatchId(null);
    fetchCustomers();
  };

  const deleteCustomer = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Customer removed"); fetchCustomers();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground mt-1">Organized by batch — owner only</p>
        </div>
        <Dialog open={batchOpen} onOpenChange={(v) => { if (!v) resetBatchForm(); else setBatchOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Batch</Button>
          </DialogTrigger>
          <DialogContent>
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
                      <UserPlus className="h-4 w-4 mr-2" />Add Customer
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
                            {c.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => editCustomer(c)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => deleteCustomer(c.id)} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
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
      <Dialog open={custOpen} onOpenChange={(v) => { if (!v) { setCustOpen(false); setEditingCustId(null); setActiveBatchId(null); } }}>
        <DialogContent>
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
            <div className="space-y-2"><Label>Address</Label><Textarea value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} maxLength={300} rows={2} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={custForm.notes} onChange={(e) => setCustForm({ ...custForm, notes: e.target.value })} maxLength={1000} /></div>
            <Button type="submit" className="w-full">{editingCustId ? "Update" : "Add"} Customer</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrBatch} onOpenChange={(v) => { if (!v) setQrBatch(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{qrBatch?.name} — Registration QR</DialogTitle>
            <DialogDescription>Customers scan this to fill in their details.</DialogDescription>
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
    </div>
  );
};

export default Customers;
