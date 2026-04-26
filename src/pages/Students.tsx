import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Phone, PhoneCall, MessageCircle, MessageSquare, Copy, QrCode, Share2, Users, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

const REGISTER_PHONE = "+91 80884 74277";
const REGISTER_PHONE_RAW = "+918088474277";
const REGISTER_MESSAGE = "Hi! I'd like to register for yoga classes. My name is ";

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  membership_type: string | null;
  membership_status: string | null;
  notes: string | null;
}

interface Batch {
  id: string;
  name: string;
  token: string;
  is_open: boolean;
  registrations_count: number;
  created_at: string;
}

const membershipTypes = ["drop-in", "monthly", "quarterly", "annual", "package"];
const membershipStatuses = ["active", "inactive", "expired"];
const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;
const normalizePhone = (p: string) => p.replace(/[^\d+]/g, "");

const Students = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPhone, setQuickPhone] = useState("");
  const [quickName, setQuickName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", membership_type: "drop-in", membership_status: "active", notes: "" });
  const [qrOpen, setQrOpen] = useState(false);
  const joinUrl = user ? `${window.location.origin}/join/${user.id}` : "";

  // Batch state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [newBatchOpen, setNewBatchOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [batchQr, setBatchQr] = useState<Batch | null>(null);

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("*").eq("user_id", user.id).order("name");
    setStudents((data as Student[]) || []);
  };

  const fetchBatches = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("registration_batches")
      .select("*")
      .order("created_at", { ascending: false });
    setBatches((data as Batch[]) || []);
  };

  useEffect(() => { fetch(); fetchBatches(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.phone && !phoneRegex.test(form.phone.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }
    const payload = { user_id: user.id, name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null, membership_type: form.membership_type, membership_status: form.membership_status, notes: form.notes.trim() || null };
    if (editingId) {
      const { error } = await supabase.from("students").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Student updated!");
    } else {
      const { error } = await supabase.from("students").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Student added!");
    }
    resetForm();
    fetch();
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const phone = quickPhone.trim();
    if (!phoneRegex.test(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }
    const normalized = normalizePhone(phone);
    const dupe = students.find((s) => s.phone && normalizePhone(s.phone) === normalized);
    if (dupe) {
      toast.error(`${dupe.name} already exists with this phone`);
      return;
    }
    const name = (quickName.trim() || `Caller ${normalized.slice(-4)}`).slice(0, 100);
    const { error } = await supabase.from("students").insert({
      user_id: user.id, name, phone, membership_type: "drop-in", membership_status: "active",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Added — you can fill in details later");
    setQuickPhone(""); setQuickName(""); setQuickOpen(false);
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    toast.success("Student deleted!");
    fetch();
  };

  const handleEdit = (s: Student) => {
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email || "", phone: s.phone || "", address: s.address || "", membership_type: s.membership_type || "drop-in", membership_status: s.membership_status || "active", notes: s.notes || "" });
    setOpen(true);
  };

  const resetForm = () => { setForm({ name: "", email: "", phone: "", address: "", membership_type: "drop-in", membership_status: "active", notes: "" }); setEditingId(null); setOpen(false); };

  // Batch handlers
  const createBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = newBatchName.trim();
    if (!name) { toast.error("Give the batch a name"); return; }
    const { data, error } = await supabase
      .from("registration_batches")
      .insert({ owner_id: user.id, name })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    toast.success("Batch QR ready");
    setNewBatchName("");
    setNewBatchOpen(false);
    setBatchQr(data as Batch);
    fetchBatches();
  };

  const toggleBatch = async (b: Batch) => {
    const { error } = await supabase
      .from("registration_batches")
      .update({ is_open: !b.is_open, closed_at: b.is_open ? new Date().toISOString() : null })
      .eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    toast.success(b.is_open ? "Batch closed" : "Batch reopened");
    fetchBatches();
  };

  const deleteBatch = async (id: string) => {
    await supabase.from("registration_batches").delete().eq("id", id);
    toast.success("Batch deleted");
    fetchBatches();
  };

  const batchUrl = (token: string) => `${window.location.origin}/b/${token}`;

  const statusColor = (s: string | null) => {
    if (s === "active") return "bg-success/10 text-success";
    if (s === "expired") return "bg-destructive/10 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground mt-1">Manage your student database</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><PhoneCall className="h-4 w-4 mr-2" />Quick Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Quick Add by Phone</DialogTitle>
                <DialogDescription>Capture a caller in seconds. You can fill in the rest later.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleQuickAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone number</Label>
                  <Input type="tel" autoFocus inputMode="tel" placeholder="+91 98765 43210" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} maxLength={20} required />
                </div>
                <div className="space-y-2">
                  <Label>Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input placeholder="Leave blank to fill later" value={quickName} onChange={(e) => setQuickName(e.target.value)} maxLength={100} />
                </div>
                <Button type="submit" className="w-full"><PhoneCall className="h-4 w-4 mr-2" />Save Caller</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Student</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editingId ? "Edit" : "Add"} Student</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
                  <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} /></div>
                </div>
                <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} rows={2} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Membership</Label>
                    <Select value={form.membership_type} onValueChange={(v) => setForm({ ...form, membership_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{membershipTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.membership_status} onValueChange={(v) => setForm({ ...form, membership_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{membershipStatuses.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} /></div>
                <Button type="submit" className="w-full">{editingId ? "Update" : "Add"} Student</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Batch QR */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Batch Sign-Up</p>
              <h2 className="font-display text-xl font-semibold mt-1">One QR for the whole group</h2>
              <p className="text-sm text-muted-foreground mt-1">Generate a QR for a batch — every student scans it once and fills name, phone, email, address.</p>
            </div>
            <Dialog open={newBatchOpen} onOpenChange={setNewBatchOpen}>
              <DialogTrigger asChild>
                <Button><QrCode className="h-4 w-4 mr-2" />New Batch QR</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Create batch</DialogTitle>
                  <DialogDescription>Name the batch so you can find it later.</DialogDescription>
                </DialogHeader>
                <form onSubmit={createBatch} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Batch name</Label>
                    <Input autoFocus placeholder="Morning Class — Apr 26" value={newBatchName} onChange={(e) => setNewBatchName(e.target.value)} maxLength={80} required />
                  </div>
                  <Button type="submit" className="w-full">Generate QR</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No batches yet — create one to get a shareable QR.</p>
          ) : (
            <div className="grid gap-2">
              {batches.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-background/60 border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{b.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_open ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {b.is_open ? "Open" : "Closed"}
                      </span>
                      <span className="text-xs text-muted-foreground">{b.registrations_count} registered</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{batchUrl(b.token)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setBatchQr(b)} aria-label="Show QR" className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"><QrCode className="h-4 w-4" /></button>
                    <button onClick={() => { navigator.clipboard.writeText(batchUrl(b.token)); toast.success("Link copied"); }} aria-label="Copy link" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => toggleBatch(b)} aria-label={b.is_open ? "Close batch" : "Open batch"} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      {b.is_open ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                    <button onClick={() => deleteBatch(b.id)} aria-label="Delete" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call to register */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">Call to Register</p>
            <h2 className="font-display text-xl font-semibold mt-1">{REGISTER_PHONE}</h2>
            <p className="text-sm text-muted-foreground mt-1">Share this number — new students can reach you 3 ways.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button asChild size="sm" variant="default">
              <a href={`tel:${REGISTER_PHONE_RAW}`}><Phone className="h-4 w-4 mr-2" />Call</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/${REGISTER_PHONE_RAW.replace("+", "")}?text=${encodeURIComponent(REGISTER_MESSAGE)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`sms:${REGISTER_PHONE_RAW}?body=${encodeURIComponent(REGISTER_MESSAGE)}`}>
                <MessageSquare className="h-4 w-4 mr-2" />SMS
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(REGISTER_PHONE); toast.success("Number copied"); }} aria-label="Copy number">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permanent join link */}
      <Card className="border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-accent-foreground/80">Permanent Join Link</p>
            <h2 className="font-display text-xl font-semibold mt-1">Always-on sign-up</h2>
            <p className="text-sm text-muted-foreground mt-1">A long-lived link for your website / bio.</p>
            <code className="block mt-2 text-xs bg-muted/60 rounded px-2 py-1 truncate">{joinUrl}</code>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="default" onClick={() => setQrOpen(true)}>
              <QrCode className="h-4 w-4 mr-2" />Show QR
            </Button>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(joinUrl); toast.success("Link copied"); }}>
              <Copy className="h-4 w-4 mr-2" />Copy link
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/?text=${encodeURIComponent(`Join our yoga studio: ${joinUrl}`)}`} target="_blank" rel="noopener noreferrer">
                <Share2 className="h-4 w-4 mr-2" />Share
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Permanent QR dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Scan to join</DialogTitle>
            <DialogDescription>Show this QR — students scan and register themselves.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center bg-white p-6 rounded-lg">
            {joinUrl && <QRCodeSVG value={joinUrl} size={220} level="M" />}
          </div>
          <p className="text-xs text-center text-muted-foreground break-all">{joinUrl}</p>
        </DialogContent>
      </Dialog>

      {/* Batch QR dialog */}
      <Dialog open={!!batchQr} onOpenChange={(v) => !v && setBatchQr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{batchQr?.name}</DialogTitle>
            <DialogDescription>Show this — every student scans the same code.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center bg-white p-6 rounded-lg">
            {batchQr && <QRCodeSVG value={batchUrl(batchQr.token)} size={240} level="M" />}
          </div>
          {batchQr && (
            <>
              <p className="text-xs text-center text-muted-foreground break-all">{batchUrl(batchQr.token)}</p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(batchUrl(batchQr.token)); toast.success("Link copied"); }}>
                  <Copy className="h-4 w-4 mr-2" />Copy link
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Register for ${batchQr.name}: ${batchUrl(batchQr.token)}`)}`} target="_blank" rel="noopener noreferrer">
                    <Share2 className="h-4 w-4 mr-2" />Share
                  </a>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {students.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No students yet. Tap <span className="font-medium">Quick Add</span> to capture a caller in seconds.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {students.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(s.membership_status)}`}>{s.membership_status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{s.membership_type} · {s.email || s.phone || "No contact"}</p>
                  {s.address && <p className="text-xs text-muted-foreground truncate mt-0.5">📍 {s.address}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.phone && (
                    <a href={`tel:${normalizePhone(s.phone)}`} aria-label={`Call ${s.name}`} className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <button onClick={() => handleEdit(s)} aria-label="Edit" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(s.id)} aria-label="Delete" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Students;
