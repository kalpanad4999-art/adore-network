import { ReactNode, useEffect, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lock, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";

const SESSION_KEY = "trinetra-app-unlocked";

const AppLockGuard = ({ children }: { children: ReactNode }) => {
  const { appLockPinSet, verifyAppLockPin, setAppLockPin, loading } = useStudio();
  const { signOut, user } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [acctPassword, setAcctPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(SESSION_KEY) === "1");
  }, [user?.id]);

  if (loading) return null;
  if (!appLockPinSet || unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    const ok = await verifyAppLockPin(pin);
    setChecking(false);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
      setError("");
    } else {
      setError("Incorrect PIN");
      setPin("");
    }
  };

  const resetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setResetting(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: acctPassword,
      });
      if (authErr) throw authErr;
      await setAppLockPin(null);
      sessionStorage.setItem(SESSION_KEY, "1");
      setUnlocked(true);
      setForgotOpen(false);
      setAcctPassword("");
      toast.success("App lock removed. Set a new PIN in Settings.");
    } catch (err: any) {
      toast.error(err.message || "Incorrect account password");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">App is locked</CardTitle>
          <CardDescription>Enter your app PIN to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="••••"
                className="text-center text-lg tracking-widest"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={checking || pin.length < 4}>
              {checking ? "Checking…" : "Unlock"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setForgotOpen(true)}
            >
              <KeyRound className="h-4 w-4" /> Forgot PIN?
            </Button>
            <Button type="button" variant="ghost" className="w-full gap-2" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Reset App Lock PIN</DialogTitle>
            <DialogDescription>
              Confirm your account password to remove the App Lock. You can set a new PIN from Settings afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={resetPin} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account password</Label>
              <Input
                type="password"
                autoFocus
                value={acctPassword}
                onChange={(e) => setAcctPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={resetting || acctPassword.length < 6}>
                {resetting ? "Verifying…" : "Reset PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppLockGuard;
