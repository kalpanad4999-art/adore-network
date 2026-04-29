import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

interface BatchInfo { id: string; name: string; description: string | null; fee: number; start_date: string | null; }

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

const Join = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc("get_batch_by_token", { _token: token });
      if (error || !data || (data as BatchInfo[]).length === 0) {
        setBatch(null);
      } else {
        setBatch((data as BatchInfo[])[0]);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (form.phone && !phoneRegex.test(form.phone.trim())) { toast.error("Enter a valid phone"); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("register_student_via_token", {
      _token: token,
      _name: form.name,
      _email: form.email,
      _phone: form.phone,
      _address: form.address,
      _notes: form.notes,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!batch) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full"><CardContent className="py-10 text-center text-muted-foreground">Invalid or expired registration link.</CardContent></Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="font-display text-2xl">You're registered!</h2>
            <p className="text-muted-foreground">Welcome to {batch.name}. The studio will be in touch.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Join {batch.name}</CardTitle>
          <CardDescription>
            {batch.description || "Fill in your details to register."}
            <div className="mt-2 text-foreground font-medium">Fee: ₹{Number(batch.fee).toLocaleString()}</div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Full name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required /></div>
            <div className="space-y-2"><Label>Phone</Label><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} /></div>
            <div className="space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={300} rows={2} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} rows={2} /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Submitting..." : "Register"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Join;
