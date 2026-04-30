import { ReactNode, useEffect, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { useLocation } from "react-router-dom";

const SESSION_KEY = "trinetra-payments-unlocked";

const PaymentsGuard = ({ children }: { children: ReactNode }) => {
  const { paymentsPinSet, verifyPaymentsPin, loading } = useStudio();
  const location = useLocation();
  const [unlocked, setUnlocked] = useState<boolean>(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // Re-lock when navigating away from Payments
  useEffect(() => {
    if (!location.pathname.startsWith("/payments")) {
      sessionStorage.removeItem(SESSION_KEY);
      setUnlocked(false);
      setPin("");
    }
  }, [location.pathname]);

  if (loading) return null;
  if (!paymentsPinSet) return <>{children}</>;
  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    const ok = await verifyPaymentsPin(pin);
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

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">Payments are locked</CardTitle>
          <CardDescription>Enter the security PIN to continue.</CardDescription>
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsGuard;
