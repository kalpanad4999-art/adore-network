import { useEffect, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Lock, ShieldCheck, ShieldAlert, KeyRound, Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { biometricSupported } from "@/lib/biometric";

export const SecurityCard = () => {
  const {
    isOwner, paymentsPinSet, biometricEnabled,
    setPaymentsPassword, enableBiometric, disableBiometric,
  } = useStudio();

  const [currentLockPwd, setCurrentLockPwd] = useState("");
  const [newLockPwd, setNewLockPwd] = useState("");
  const [confirmLockPwd, setConfirmLockPwd] = useState("");
  const [savingLock, setSavingLock] = useState(false);
  const [removingLock, setRemovingLock] = useState(false);
  const [removePwd, setRemovePwd] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => { biometricSupported().then(setBioAvailable); }, []);

  if (!isOwner) return null;

  const handleLockSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newLockPwd.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    if (newLockPwd !== confirmLockPwd) { toast.error("Passwords do not match"); return; }
    setSavingLock(true);
    try {
      await setPaymentsPassword(newLockPwd, paymentsPinSet ? currentLockPwd : undefined);
      setCurrentLockPwd(""); setNewLockPwd(""); setConfirmLockPwd("");
      toast.success(paymentsPinSet ? "Payment Lock password updated" : "Payment Lock enabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to save password");
    } finally { setSavingLock(false); }
  };

  const handleDisableLock = async () => {
    setRemovingLock(true);
    try {
      await setPaymentsPassword(null, removePwd);
      setRemovePwd("");
      toast.success("Payment Lock disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to disable Payment Lock");
    } finally { setRemovingLock(false); }
  };

  const handleEnableBio = async () => {
    setBioBusy(true);
    try { await enableBiometric(); toast.success("Fingerprint unlock enabled"); }
    catch (err: any) { toast.error(err.message || "Could not enable fingerprint"); }
    finally { setBioBusy(false); }
  };
  const handleDisableBio = async () => {
    setBioBusy(true);
    try { await disableBiometric(); toast.success("Fingerprint unlock disabled"); }
    finally { setBioBusy(false); }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Security Settings
        </CardTitle>
        <CardDescription>
          Protect payment actions with a password and optional fingerprint unlock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 ${paymentsPinSet ? "bg-primary/5 border-primary/30" : "bg-muted/40"}`}>
            <Lock className={`h-4 w-4 ${paymentsPinSet ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-xs">
              <div className="font-medium">Payment Lock</div>
              <div className="text-muted-foreground">{paymentsPinSet ? "Active" : "Off"}</div>
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 ${paymentsPinSet ? "bg-primary/5 border-primary/30" : "bg-muted/40"}`}>
            <KeyRound className={`h-4 w-4 ${paymentsPinSet ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-xs">
              <div className="font-medium">Password</div>
              <div className="text-muted-foreground">{paymentsPinSet ? "Enabled" : "Not set"}</div>
            </div>
          </div>
          <div className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 ${biometricEnabled ? "bg-primary/5 border-primary/30" : "bg-muted/40"}`}>
            <Fingerprint className={`h-4 w-4 ${biometricEnabled ? "text-primary" : "text-muted-foreground"}`} />
            <div className="text-xs">
              <div className="font-medium">Fingerprint</div>
              <div className="text-muted-foreground">{biometricEnabled ? "Enabled" : (bioAvailable ? "Off" : "Unavailable")}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleLockSave} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Label className="font-medium">{paymentsPinSet ? "Change Payment Lock password" : "Create Payment Lock password"}</Label>
            {paymentsPinSet && <Badge variant="secondary">Owner only</Badge>}
          </div>
          {paymentsPinSet && (
            <div className="space-y-1.5">
              <Label className="text-xs">Current password</Label>
              <Input type="password" autoComplete="current-password" value={currentLockPwd}
                onChange={(e) => setCurrentLockPwd(e.target.value)} placeholder="Current password" />
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{paymentsPinSet ? "New password" : "Password"}</Label>
              <Input type="password" autoComplete="new-password" minLength={4} value={newLockPwd}
                onChange={(e) => setNewLockPwd(e.target.value)} placeholder="At least 4 characters" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Confirm</Label>
              <Input type="password" autoComplete="new-password" minLength={4} value={confirmLockPwd}
                onChange={(e) => setConfirmLockPwd(e.target.value)} placeholder="Repeat password" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={savingLock}>
              {savingLock ? "Saving…" : paymentsPinSet ? "Update password" : "Enable Payment Lock"}
            </Button>
            {paymentsPinSet && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="gap-2 text-destructive hover:text-destructive">
                    <ShieldAlert className="h-4 w-4" /> Disable Payment Lock
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable Payment Lock?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Disabling Payment Lock will reduce protection for payment records. Continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Confirm current password</Label>
                    <Input type="password" value={removePwd} onChange={(e) => setRemovePwd(e.target.value)} placeholder="Current password" />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRemovePwd("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={removingLock || !removePwd}
                      onClick={(e) => { e.preventDefault(); handleDisableLock(); }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {removingLock ? "Disabling…" : "Yes, disable"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Label className="font-medium flex items-center gap-2">
                <Fingerprint className="h-4 w-4" /> Fingerprint unlock
              </Label>
              <p className="text-xs text-muted-foreground">
                {bioAvailable
                  ? "Unlock the Payments area with your device fingerprint or face. Falls back to your password if biometrics fail."
                  : "This device does not support a built-in biometric authenticator. Password will be used as fallback."}
              </p>
            </div>
            <Switch
              checked={biometricEnabled}
              disabled={!bioAvailable || !paymentsPinSet || bioBusy}
              onCheckedChange={(checked) => { if (checked) handleEnableBio(); else handleDisableBio(); }}
            />
          </div>
          {!paymentsPinSet && (
            <p className="text-xs text-muted-foreground">Set a Payment Lock password before enabling fingerprint.</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Only the owner account can change these security settings. Staff can use the Payments area after unlocking but cannot modify the lock.
        </p>
      </CardContent>
    </Card>
  );
};

export default SecurityCard;
