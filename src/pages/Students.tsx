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
import { Plus, Pencil, Trash2, Phone, PhoneCall, MessageCircle, MessageSquare, Copy } from "lucide-react";
import { toast } from "sonner";

const REGISTER_PHONE = "+91 80884 74277";
const REGISTER_PHONE_RAW = "+918088474277";
const REGISTER_MESSAGE = "Hi! I'd like to register for yoga classes. My name is ";

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  membership_type: string | null;
  membership_status: string | null;
  notes: string | null;
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", membership_type: "drop-in", membership_status: "active", notes: "" });

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase.from("students").select("*").eq("user_id", user.id).order("name");
    setStudents((data as Student[]) || []);
  };

  useEffect(() => { fetch(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.phone && !phoneRegex.test(form.phone.trim())) {
      toast.error("Enter a valid phone number");
      return;
    }
    const payload = { user_id: user.id, name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, membership_type: form.membership_type, membership_status: form.membership_status, notes: form.notes.trim() || null };
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
    const name = (quickName.trim() || `Caller ${normalizePhone(phone).slice(-4)}`).slice(0, 100);
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
    setForm({ name: s.name, email: s.email || "", phone: s.phone || "", membership_type: s.membership_type || "drop-in", membership_status: s.membership_status || "active", notes: s.notes || "" });
    setOpen(true);
  };

  const resetForm = () => { setForm({ name: "", email: "", phone: "", membership_type: "drop-in", membership_status: "active", notes: "" }); setEditingId(null); setOpen(false); };

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
