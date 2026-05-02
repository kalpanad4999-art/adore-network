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
    <div className="min-h-screen bg-background flex items-start md:items-center justify-center p-4 md:p-8">
      <Card className="max-w-2xl w-full border-none md:border md:shadow-sm">
        <CardHeader className="px-2 md:px-6">
          <CardTitle className="font-display text-3xl">Join {batch.name}</CardTitle>
          {batch.description && (
            <CardDescription className="text-base">{batch.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <form onSubmit={submit} className="space-y-7">
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
                required
                className="h-14 rounded-xl border-2 text-base px-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Email Address</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
                className="h-14 rounded-xl border-2 text-base px-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Phone Number</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={20}
                className="h-14 rounded-xl border-2 text-base px-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Address</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                maxLength={500}
                rows={4}
                className="rounded-xl border-2 text-base px-4 py-3 min-h-[120px]"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <a
                href="https://youtube.com/@clearpictures8918?si=NEN__ftlagnEfnpV"
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-lg text-primary hover:underline"
              >
                Follow us on YouTube
              </a>
              <Button
                type="submit"
                disabled={submitting}
                className="h-14 px-12 text-base font-semibold rounded-xl"
              >
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Join;
