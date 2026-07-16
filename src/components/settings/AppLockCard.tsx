import { useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const AppLockCard = () => {
  const { isOwner, appLockPinSet, setAppLockPin } = useStudio();
  const [appPin, setAppPin] = useState("");
  const [appConfirm, setAppConfirm] = useState("");
  const [savingAppPin, setSavingAppPin] = useState(false);

  if (!isOwner) return null;

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
  );
};

export default AppLockCard;
