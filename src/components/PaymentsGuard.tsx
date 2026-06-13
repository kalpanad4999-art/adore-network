import { ReactNode, useEffect, useRef, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock, Fingerprint } from "lucide-react";
import { useLocation } from "react-router-dom";

const SESSION_KEY = "trinetra-payments-unlocked-at";
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const isStillUnlocked = () => {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < TIMEOUT_MS;
};

const PaymentsGuard = ({ children }: { children: ReactNode }) => {
  const { paymentsPinSet, verifyPaymentsPin, biometricEnabled, verifyBiometricUnlock, loading } = useStudio();
  const location = useLocation();
  const [unlocked, setUnlocked] = useState<boolean>(() => isStillUnlocked());
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Clear when leaving payments area
  useEffect(() => {
    if (!location.pathname.startsWith("/payments")) {
      sessionStorage.removeItem(SESSION_KEY);
      setUnlocked(false);
      setPassword("");
    }
  }, [location.pathname]);

  // Auto-relock after 10 minutes
  useEffect(() => {
    if (!unlocked) return;
    const raw = sessionStorage.getItem(SESSION_KEY);
    const ts = raw ? parseInt(raw, 10) : Date.now();
    const remaining = Math.max(0, TIMEOUT_MS - (Date.now() - ts));
    timerRef.current = window.setTimeout(() => {
      sessionStorage.removeItem(SESSION_KEY);
      setUnlocked(false);
    }, remaining);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [unlocked]);

  // Auto-prompt biometric on mount when enabled
  useEffect(() => {
    if (loading || unlocked || !paymentsPinSet || !biometricEnabled) return;
    // single auto-prompt per mount
    let cancelled = false;
    (async () => {
      setBioBusy(true);
      const ok = await verifyBiometricUnlock();
      if (cancelled) return;
      if (ok) {
        sessionStorage.setItem(SESSION_KEY, String(Date.now()));
        setUnlocked(true);
      }
      setBioBusy(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, paymentsPinSet, biometricEnabled]);

  if (loading) return null;
  if (!paymentsPinSet) return <>{children}</>;
  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const ok = await verifyPaymentsPin(password);
    setBusy(false);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
      setUnlocked(true);
    } else {
      setError("Incorrect password"); setPassword("");
    }
  };

  const bioUnlock = async () => {
    setBioBusy(true);
    const ok = await verifyBiometricUnlock();
    setBioBusy(false);
    if (ok) {
      sessionStorage.setItem(SESSION_KEY, String(Date.now()));
      setUnlocked(true);
    } else {
      setError("Fingerprint not recognized — use your password");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">Payments are locked</CardTitle>
          <CardDescription>
            {biometricEnabled
              ? "Use fingerprint or enter your password to continue."
              : "Enter your Payment Lock password to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {biometricEnabled && (
            <Button type="button" variant="outline" className="w-full mb-4 gap-2" onClick={bioUnlock} disabled={bioBusy}>
              <Fingerprint className="h-4 w-4" />
              {bioBusy ? "Waiting for fingerprint…" : "Unlock with fingerprint"}
            </Button>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                autoFocus={!biometricEnabled}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={busy || password.length < 4}>
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Auto-locks after 10 minutes of access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsGuard;
