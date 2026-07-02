import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCog, Loader2, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Step = "verify" | "target" | "create" | "confirm" | "done";

export const TransferOwnershipCard = () => {
  const { user, signOut } = useAuth();
  const { refresh } = useStudio();

  const [step, setStep] = useState<Step>("verify");
  const [busy, setBusy] = useState(false);

  // step 1
  const [currentEmail, setCurrentEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");

  // step 2
  const [targetEmail, setTargetEmail] = useState("");
  const [foundUser, setFoundUser] = useState<{ id: string; full_name: string | null; email: string } | null>(null);

  // step 3 (create)
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");

  // confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reset = () => {
    setStep("verify");
    setCurrentPassword("");
    setTargetEmail("");
    setFoundUser(null);
    setNewFullName(""); setNewPhone(""); setNewPassword(""); setNewConfirm("");
  };

  const invoke = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke("transfer-ownership", { body: payload });
    if (error) throw new Error(error.message || "Request failed");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleVerifyStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail.trim() || currentPassword.length < 1) {
      toast.error("Enter your email and password");
      return;
    }
    setStep("target");
  };

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = targetEmail.trim().toLowerCase();
    if (!email) { toast.error("Enter the new owner's email"); return; }
    if (email === currentEmail.trim().toLowerCase()) {
      toast.error("New owner must be a different account"); return;
    }
    setBusy(true);
    try {
      const data = await invoke({ action: "check_email", email });
      if (data.exists) {
        setFoundUser(data.user);
        setStep("confirm");
      } else {
        setFoundUser(null);
        setStep("create");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  const handleCreateAndConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFullName.trim().length < 2) { toast.error("Enter full name"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== newConfirm) { toast.error("Passwords do not match"); return; }
    setStep("confirm");
    setConfirmOpen(true);
  };

  const executeTransfer = async () => {
    setBusy(true);
    try {
      await invoke({
        action: "transfer",
        currentEmail: currentEmail.trim().toLowerCase(),
        currentPassword,
        targetEmail: targetEmail.trim().toLowerCase(),
        createNew: !foundUser,
        newUser: foundUser ? undefined : {
          fullName: newFullName.trim(),
          phone: newPhone.trim(),
          password: newPassword,
        },
      });
      setConfirmOpen(false);
      setStep("done");
      toast.success("Ownership transferred successfully");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
      setConfirmOpen(false);
    } finally { setBusy(false); }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <UserCog className="h-5 w-5 text-primary" /> Transfer Ownership
        </CardTitle>
        <CardDescription>
          Move full administrative access to another account. Your account will become Staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step indicator */}
        {step !== "done" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={step === "verify" ? "default" : "secondary"}>1. Verify</Badge>
            <Badge variant={step === "target" ? "default" : "secondary"}>2. New owner</Badge>
            {step === "create" && <Badge variant="default">3. Create account</Badge>}
            <Badge variant={step === "confirm" ? "default" : "secondary"}>{step === "create" ? "4" : "3"}. Confirm</Badge>
          </div>
        )}

        {/* Step 1: verify current owner */}
        {step === "verify" && (
          <form onSubmit={handleVerifyStep} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Current owner email</Label>
              <Input type="email" value={currentEmail} onChange={(e) => setCurrentEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <Input type="password" autoComplete="current-password"
                value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Step 2: new owner email */}
        {step === "target" && (
          <form onSubmit={handleCheckEmail} className="space-y-3">
            <div className="space-y-1.5">
              <Label>New owner email</Label>
              <Input type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="person@example.com" required />
              <p className="text-xs text-muted-foreground">
                We'll check if this account exists. If not, you can create it in the next step.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("verify")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continue
              </Button>
            </div>
          </form>
        )}

        {/* Step 3a: create new account */}
        {step === "create" && (
          <form onSubmit={handleCreateAndConfirm} className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              No account found for <span className="font-medium">{targetEmail}</span>. Create a new owner account below.
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={targetEmail} disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" autoComplete="new-password" minLength={6}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Confirm password</Label>
                <Input type="password" autoComplete="new-password" minLength={6}
                  value={newConfirm} onChange={(e) => setNewConfirm(e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setStep("target")} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="gap-2">Review transfer <ArrowRight className="h-4 w-4" /></Button>
            </div>
          </form>
        )}

        {/* Step 4: confirm (existing user path) */}
        {step === "confirm" && foundUser && (
          <div className="space-y-3">
            <div className="rounded-lg border p-4 space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">New owner</div>
              <div className="font-medium">{foundUser.full_name || "(No name on file)"}</div>
              <div className="text-sm text-muted-foreground">{foundUser.email}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => { setStep("target"); setFoundUser(null); }} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setConfirmOpen(true)} className="gap-2">
                Transfer ownership <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-medium">Ownership transferred successfully.</div>
                <div className="text-muted-foreground mt-1">
                  The new owner now has full administrative access. Your account has been changed to Staff.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={reset}>Close</Button>
              <Button onClick={async () => { await signOut(); }}>Sign out</Button>
            </div>
          </div>
        )}

        {/* Confirm dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to transfer ownership? The selected account will become
                the new Owner, and your account will automatically become a Staff account.
                All customers, payments, renewals, attendance, classes, gallery and settings
                will remain intact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={(e) => { e.preventDefault(); executeTransfer(); }}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Transferring…</> : "Confirm Transfer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
