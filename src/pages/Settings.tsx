import { useEffect, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
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
import { Lock, ShieldCheck, ShieldAlert, Sun, Moon, Check, KeyRound, Fingerprint, History } from "lucide-react";
import { toast } from "sonner";
import { biometricSupported } from "@/lib/biometric";
import { TransferOwnershipCard } from "@/components/TransferOwnershipCard";
import { ChatbotKnowledgeCard } from "@/components/ChatbotKnowledgeCard";


const Settings = () => {
  const {
    isOwner, ownerId,
    paymentsPinSet, appLockPinSet,
    biometricEnabled,
    setPaymentsPassword, enableBiometric, disableBiometric,
    setAppLockPin,
  } = useStudio();
  const { theme, setTheme } = useTheme();

  // Payment Lock password state
  const [currentLockPwd, setCurrentLockPwd] = useState("");
  const [newLockPwd, setNewLockPwd] = useState("");
  const [confirmLockPwd, setConfirmLockPwd] = useState("");
  const [savingLock, setSavingLock] = useState(false);
  const [removingLock, setRemovingLock] = useState(false);
  const [removePwd, setRemovePwd] = useState("");

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  // App lock PIN
  const [appPin, setAppPin] = useState("");
  const [appConfirm, setAppConfirm] = useState("");
  const [savingAppPin, setSavingAppPin] = useState(false);

  useEffect(() => { biometricSupported().then(setBioAvailable); }, []);


  if (!isOwner) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-10 text-center text-muted-foreground">
          Only the studio owner can manage settings.
        </CardContent>
      </Card>
    );
  }


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
    try {
      await enableBiometric();
      toast.success("Fingerprint unlock enabled");
    } catch (err: any) {
      toast.error(err.message || "Could not enable fingerprint");
    } finally { setBioBusy(false); }
  };

  const handleDisableBio = async () => {
    setBioBusy(true);
    try {
      await disableBiometric();
      toast.success("Fingerprint unlock disabled");
    } finally { setBioBusy(false); }
  };

  const handleAppPinSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(appPin)) { toast.error("PIN must be 4–6 digits"); return; }
    if (appPin !== appConfirm) { toast.error("PINs do not match"); return; }
    setSavingAppPin(true);
    await setAppLockPin(appPin);
    setSavingAppPin(false);
    setAppPin(""); setAppConfirm("");
    toast.success("App lock PIN saved");
  };
  const handleAppPinClear = async () => { await setAppLockPin(null); toast.success("App lock removed"); };


  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your studio's look and security.</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} Appearance
          </CardTitle>
          <CardDescription>Choose how TRINETRA looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button type="button" onClick={() => { setTheme("light"); toast.success("Light mode on"); }}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <Sun className="h-5 w-5" /><span className="font-medium">Light</span>
              {theme === "light" && <Check className="h-4 w-4 text-primary ml-1" />}
            </button>
            <button type="button" onClick={() => { setTheme("dark"); toast.success("Dark mode on"); }}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <Moon className="h-5 w-5" /><span className="font-medium">Dark</span>
              {theme === "dark" && <Check className="h-4 w-4 text-primary ml-1" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
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
          {/* Status indicators */}
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

          {/* Password form */}
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

          {/* Biometric */}
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
                onCheckedChange={(checked) => {
                  if (checked) handleEnableBio();
                  else handleDisableBio();
                }}
              />
            </div>
            {!paymentsPinSet && (
              <p className="text-xs text-muted-foreground">Set a Payment Lock password before enabling fingerprint.</p>
            )}
          </div>

          {/* Access control note */}
          <p className="text-xs text-muted-foreground">
            Only the owner account can change these security settings. Staff can use the Payments area after unlocking but cannot modify the lock.
          </p>
        </CardContent>
      </Card>


      {/* App Lock PIN */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><Lock className="h-5 w-5" /> App Lock PIN</CardTitle>
          <CardDescription>
            {appLockPinSet ? "App lock is on. This PIN is required after sign-in." : "Set a 4–6 digit PIN required after sign-in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {appLockPinSet && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> App is locked after sign-in
            </div>
          )}
          <form onSubmit={handleAppPinSave} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{appLockPinSet ? "New PIN" : "PIN"}</Label>
                <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
                  value={appPin} onChange={(e) => setAppPin(e.target.value.replace(/\D/g, ""))} placeholder="4–6 digits" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm PIN</Label>
                <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
                  value={appConfirm} onChange={(e) => setAppConfirm(e.target.value.replace(/\D/g, ""))} placeholder="Repeat PIN" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingAppPin}>
                {savingAppPin ? "Saving…" : appLockPinSet ? "Update PIN" : "Set PIN"}
              </Button>
              {appLockPinSet && (
                <Button type="button" variant="ghost" onClick={handleAppPinClear} className="text-destructive hover:text-destructive">
                  Remove PIN
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* AI Chatbot Knowledge Base */}
      <ChatbotKnowledgeCard />

      {/* Transfer Ownership */}
      <TransferOwnershipCard />

    </div>
  );
};

export default Settings;
