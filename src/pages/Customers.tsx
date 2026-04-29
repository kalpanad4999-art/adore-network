import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  batch_id: string | null;
}

interface Batch {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  fee: number;
}

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

const Customers = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Customer form
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "", batch_id: "" });

  // Batch form
  const [batchOpen, setBatchOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({ name: "", description: "", start_date: "", fee: "" });

  const fetchCustomers = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("id,name,email,phone,address,notes,batch_id").eq("user_id", user.id).order("name");
    setCustomers((data as Customer[]) || []);
  };
  const fetchBatches = async () => {
    if (!user) return;
    const { data } = await supabase.from("batches").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setBatches((data as Batch[]) || []);
  };
  useEffect(() => { fetchCustomers(); fetchBatches(); }, [user]);

  const batchById = useMemo(() => {
    const m = new Map<string, Batch>();
    batches.forEach((b) => m.set(b.id, b));
    return m;
  }, [batches]);

  // ---------- Customer CRUD ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.phone && !phoneRegex.test(form.phone.trim())) { toast.error("Enter a valid phone"); return; }
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      batch_id: form.batch_id || null,
    };
    const { error } = editingId
      ? await supabase.from("students").update(payload).eq("id", editingId)
      : await supabase.from("students").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Customer updated" : "Customer added");
    resetForm(); fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Customer removed"); fetchCustomers();
  };

  const handleEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      name: c.name, email: c.email || "", phone: c.phone || "",
      address: c.address || "", notes: c.notes || "", batch_id: c.batch_id || "",
    });
    setOpen(true);
  };

  const resetForm = () => {
    setForm({ name: "", email: "", phone: "", address: "", notes: "", batch_id: "" });
    setEditingId(null); setOpen(false);
  };

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
    setBatchForm({
      name: b.name,
      description: b.description || "",
      start_date: b.start_date || "",
      fee: b.fee?.toString() || "",
    });
    setBatchOpen(true);
  };

  const deleteBatch = async (id: string) => {
    await supabase.from("batches").delete().eq("id", id);
    toast.success("Batch removed"); fetchBatches(); fetchCustomers();
  };

  const resetBatchForm = () => {
    setBatchForm({ name: "", description: "", start_date: "", fee: "" });
    setEditingBatchId(null); setBatchOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Customers</h1>
        <p className="text-muted-foreground mt-1">Manage students and batches in one place</p>
      </div>

      {/* ============ BATCHES SECTION ============ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold">Batches</h2>
            <span className="text-sm text-muted-foreground">({batches.length})</span>
          </div>
          <Dialog open={batchOpen} onOpenChange={(v) => { if (!v) resetBatchForm(); else setBatchOpen(true); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Add Batch</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editingBatchId ? "Edit" : "Add"} Batch</DialogTitle>
                <DialogDescription>Owner-only batch details.</DialogDescription>
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
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No batches yet. Add one to organize customers.</CardContent></Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {batches.map((b) => {
              const count = customers.filter((c) => c.batch_id === b.id).length;
              return (
                <Card key={b.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{b.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{count} {count === 1 ? "member" : "members"}</span>
                      </div>
                      {b.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.description}</p>}
                      <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap">
                        {b.start_date && <span>Starts {format(new Date(b.start_date), "PP")}</span>}
                        <span>Fee ₹{Number(b.fee).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => editBatch(b)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => deleteBatch(b.id)} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ============ CUSTOMERS SECTION ============ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold">All Customers</h2>
            <span className="text-sm text-muted-foreground">({customers.length})</span>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Customer</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Batch</Label>
                  <Select value={form.batch_id || "none"} onValueChange={(v) => setForm({ ...form, batch_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No batch</SelectItem>
                      {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} rows={2} /></div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></div>
                <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Customer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {customers.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No customers yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {customers.map((c) => {
              const b = c.batch_id ? batchById.get(c.batch_id) : null;
              return (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between p-4 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{c.name}</h3>
                        {b && <span className="text-xs px-2 py-0.5 rounded-full bg-accent/40 text-accent-foreground">{b.name}</span>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {c.phone || "—"}{c.email ? ` · ${c.email}` : ""}
                      </p>
                      {c.address && <p className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => handleEdit(c)} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Customers;
