import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/contexts/StudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, ShieldCheck, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type StaffOption = { user_id: string; email: string | null; full_name: string | null };

/**
 * Three-step ownership transfer:
 *   1. Verify the current Owner with their account password
 *   2. Enter the new Owner's email (must be an existing Staff member)
 *   3. Confirm — the role swap and workspace hand-over run in one DB transaction
 */
const TransferOwnershipCard = () => {
  const { isOwner, ownerId, refresh } = useStudio();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [target, setTarget] = useState<StaffOption | null>(null);

  useEffect(() => {
    (async () => {
      if (!ownerId || !isOwner) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("owner_id", ownerId)
        .eq("role", "staff");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) { setStaff([]); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ids);
      setStaff((profiles ?? []).map((p: any) => ({ user_id: p.id, email: p.email, full_name: p.full_name })));
    })();
  }, [ownerId, isOwner]);

  if (!isOwner) return null;

  const verifyOwner = async () => {
    if (!user?.email) { toast.error("No signed-in account found"); return; }
    if (!password) { toast.error("Enter your account password"); return; }
    setBusy(true);
    try {
      // Verify against a throw-away client so the live Owner session is never
      // replaced or invalidated by the password check.
      const { createClient } = await import("@supabase/supabase-js");
      const probe = createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
      );
      const { data, error } = await probe.auth.signInWithPassword({
        email: user.email.trim().toLowerCase(),
        password,
      });
      if (error || !data?.user) {
        toast.error(
          error?.message?.toLowerCase().includes("invalid")
            ? "Incorrect account password"
            : error?.message || "Verification failed",
        );
        return;
      }
      if (data.user.id !== user.id) { toast.error("Verification failed for this account"); return; }
      await probe.auth.signOut({ scope: "local" });
      setPassword("");
      toast.success("Owner verified");
      setStep(2);
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };


  const pickNewOwner = () => {
    const cleaned = email.trim().toLowerCase();
    const found = staff.find((s) => (s.email || "").toLowerCase() === cleaned);
    if (!found) {
      toast.error("No Staff account found with that email. Invite and activate them first.");
      return;
    }
    setTarget(found);
    setStep(3);
  };

  const confirmTransfer = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("transfer_ownership", { _new_owner: target.user_id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ownership transferred. You are now a Staff member.");
    setStep(1); setTarget(null); setEmail("");
    await refresh();
    window.location.replace("/");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" /> Transfer Ownership
        </CardTitle>
        <CardDescription>
          Hand the Owner role to an existing Staff account. The workspace, database and every record
          (Members, Batches, Payments, Renewals, Attendance, Offers, Insights, Gallery, Chatbot, Settings)
          stay exactly as they are. You will be downgraded to Staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <Badge variant={step >= (n as 1 | 2 | 3) ? "default" : "secondary"}>{n}</Badge>
              <span className={step >= (n as 1 | 2 | 3) ? "text-foreground" : "text-muted-foreground"}>
                {n === 1 ? "Verify Owner" : n === 2 ? "New Owner Email" : "Confirm"}
              </span>
              {n < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3 rounded-lg border p-4">
            <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Verify current Owner</Label>
            <p className="text-xs text-muted-foreground">Signed in as {user?.email}</p>
            <Input
              type="password" autoComplete="current-password" placeholder="Account password"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={verifyOwner} disabled={busy} className="w-full sm:w-auto">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Verify
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 rounded-lg border p-4">
            <Label>New Owner email</Label>
            <Input
              type="email" placeholder="staff@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              list="transfer-staff-emails"
            />
            <datalist id="transfer-staff-emails">
              {staff.map((s) => <option key={s.user_id} value={s.email ?? ""} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              {staff.length ? "Must be an existing Staff member of this workspace." : "No Staff accounts yet — invite one first."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={pickNewOwner}>Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && target && (
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Confirm ownership transfer</p>
                <p className="text-muted-foreground">
                  {target.full_name || target.email} will become the Owner. You ({user?.email}) will become Staff
                  with full module access. This cannot be undone by you afterwards.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={busy}>Back</Button>
              <Button variant="destructive" onClick={confirmTransfer} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Transfer Ownership
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransferOwnershipCard;
