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
import SupportChatWidget from "@/components/SupportChatWidget";

interface CustomField { id: string; name: string; required: boolean; enabled: boolean; }
interface BatchInfo { id: string; name: string; description: string | null; fee: number; start_date: string | null; required_fields: string[] | null; custom_fields: CustomField[] | null; }

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;
const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const Join = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "", height: "", weight: "" });
  const [customData, setCustomData] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc("get_batch_by_token", { _token: token });
      const rows = (data || []) as any[];
      if (error || rows.length === 0) {
        setBatch(null);
      } else {
        const b = rows[0];
        setBatch({ ...b, custom_fields: Array.isArray(b.custom_fields) ? b.custom_fields : [] } as BatchInfo);
      }
      setLoading(false);
    })();
  }, [token]);

  const required = new Set(batch?.required_fields ?? ["name"]);
  const isReq = (key: string) => required.has(key);
  const activeCustomFields = (batch?.custom_fields || []).filter((f) => f.enabled !== false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const checks: { key: string; label: string; value: string }[] = [
      { key: "name", label: "Name", value: form.name.trim() },
      { key: "email", label: "Email", value: form.email.trim() },
      { key: "phone", label: "Phone", value: form.phone.trim() },
      { key: "address", label: "Address", value: form.address.trim() },
      { key: "notes", label: "Notes", value: form.notes.trim() },
      { key: "height", label: "Height", value: form.height.trim() },
      { key: "weight", label: "Weight", value: form.weight.trim() },
    ];
    for (const c of checks) {
      if (isReq(c.key) && !c.value) { toast.error(`${c.label} is required`); return; }
    }
    if (form.email && !emailRegex.test(form.email.trim())) { toast.error("Enter a valid email"); return; }
    if (form.phone && !phoneRegex.test(form.phone.trim())) { toast.error("Enter a valid phone"); return; }
    const heightNum = form.height ? Number(form.height) : null;
    const weightNum = form.weight ? Number(form.weight) : null;
    if (heightNum !== null && (Number.isNaN(heightNum) || heightNum < 30 || heightNum > 272)) { toast.error("Enter a valid height in cm"); return; }
    if (weightNum !== null && (Number.isNaN(weightNum) || weightNum < 2 || weightNum > 500)) { toast.error("Enter a valid weight in kg"); return; }

    const customClean: Record<string, string> = {};
    for (const f of activeCustomFields) {
      const v = (customData[f.id] || "").trim();
      if (f.required && !v) { toast.error(`${f.name} is required`); return; }
      if (v) customClean[f.id] = v.slice(0, 500);
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("register_student_via_token", {
      _token: token,
      _name: form.name,
      _email: form.email,
      _phone: form.phone,
      _address: form.address,
      _notes: form.notes,
      _height_cm: heightNum,
      _weight_kg: weightNum,
      _custom_data: customClean,
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
            <h2 className="font-display text-3xl">Welcome to TRINETRA YOGA</h2>
            <p className="text-lg text-foreground">You're registered for <span className="font-semibold">{batch.name}</span>.</p>
            <p className="text-muted-foreground">Namaste 🙏 The studio will be in touch with you soon.</p>
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
              <Label className="text-lg font-semibold text-foreground">Name {isReq("name") && <span className="text-destructive">*</span>}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
                required={isReq("name")}
                className="h-14 rounded-xl border-2 text-base px-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Email Address {isReq("email") && <span className="text-destructive">*</span>}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
                required={isReq("email")}
                className="h-14 rounded-xl border-2 text-base px-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Phone Number {isReq("phone") && <span className="text-destructive">*</span>}</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={20}
                required={isReq("phone")}
                className="h-14 rounded-xl border-2 text-base px-4"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-lg font-semibold text-foreground">Address {isReq("address") && <span className="text-destructive">*</span>}</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                maxLength={500}
                rows={4}
                required={isReq("address")}
                className="rounded-xl border-2 text-base px-4 py-3 min-h-[120px]"
              />
            </div>
            {isReq("notes") && (
              <div className="space-y-3">
                <Label className="text-lg font-semibold text-foreground">Notes <span className="text-destructive">*</span></Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  maxLength={500}
                  rows={3}
                  required
                  className="rounded-xl border-2 text-base px-4 py-3 min-h-[100px]"
                />
              </div>
            )}
            {(isReq("height") || isReq("weight")) && (
              <div className="grid grid-cols-2 gap-4">
                {isReq("height") && (
                  <div className="space-y-3">
                    <Label className="text-lg font-semibold text-foreground">Height (cm) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number" min={30} max={272} step="0.1"
                      value={form.height}
                      onChange={(e) => setForm({ ...form, height: e.target.value })}
                      required
                      className="h-14 rounded-xl border-2 text-base px-4"
                    />
                  </div>
                )}
                {isReq("weight") && (
                  <div className="space-y-3">
                    <Label className="text-lg font-semibold text-foreground">Weight (kg) <span className="text-destructive">*</span></Label>
                    <Input
                      type="number" min={2} max={500} step="0.1"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      required
                      className="h-14 rounded-xl border-2 text-base px-4"
                    />
                  </div>
                )}
              </div>
            )}
            {activeCustomFields.map((f) => (
              <div key={f.id} className="space-y-3">
                <Label className="text-lg font-semibold text-foreground">{f.name} {f.required && <span className="text-destructive">*</span>}</Label>
                <Input
                  value={customData[f.id] || ""}
                  onChange={(e) => setCustomData((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  maxLength={500}
                  required={f.required}
                  className="h-14 rounded-xl border-2 text-base px-4"
                />
              </div>
            ))}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <a
                  href="https://youtube.com/@clearpictures8918?si=NEN__ftlagnEfnpV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-lg text-primary hover:underline"
                >
                  Follow us on YouTube
                </a>
                <a
                  href="https://g.page/r/CeeEQEv48JHpEAE/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-display text-lg text-primary hover:underline"
                >
                  ⭐ Click here for Google Reviews
                </a>
              </div>
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
      {token && <SupportChatWidget batchToken={token} />}
    </div>
  );
};

export default Join;
