import { ReactNode, useEffect, useMemo, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock, KeyRound, HelpCircle, Fingerprint } from "lucide-react";
import { useLocation } from "react-router-dom";

const SESSION_KEY = "trinetra-payments-unlocked";

const PaymentsGuard = ({ children }: { children: ReactNode }) => {
  const {
    paymentsPinSet, paymentsPasswordSet, paymentsQuestionSet, paymentsBiometricSet,
    paymentsSecurityQuestion,
    verifyPaymentsPin, verifyPaymentsPassword, verifyPaymentsSecurityAnswer, verifyPaymentsBiometric,
    loading,
  } = useStudio();
  const location = useLocation();
  const anyLockSet = paymentsPinSet || paymentsPasswordSet || paymentsQuestionSet || paymentsBiometricSet;
  const [unlocked, setUnlocked] = useState<boolean>(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [pin, setPin] = useState("");
  const [pwd, setPwd] = useState("");
  const [ans, setAns] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const defaultTab = useMemo(() => {
    if (paymentsPinSet) return "pin";
    if (paymentsPasswordSet) return "password";
    if (paymentsQuestionSet) return "question";
    if (paymentsBiometricSet) return "biometric";
    return "pin";
  }, [paymentsPinSet, paymentsPasswordSet, paymentsQuestionSet, paymentsBiometricSet]);

  useEffect(() => {
    if (!location.pathname.startsWith("/payments")) {
      sessionStorage.removeItem(SESSION_KEY);
      setUnlocked(false);
      setPin(""); setPwd(""); setAns("");
    }
  }, [location.pathname]);

  if (loading) return null;
  if (!anyLockSet) return <>{children}</>;
  if (unlocked) return <>{children}</>;

  const succeed = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
    setError("");
  };

  const trySubmit = async (kind: "pin" | "password" | "question" | "biometric") => {
    setBusy(true); setError("");
    let ok = false;
    if (kind === "pin") ok = await verifyPaymentsPin(pin);
    else if (kind === "password") ok = await verifyPaymentsPassword(pwd);
    else if (kind === "question") ok = await verifyPaymentsSecurityAnswer(ans);
    else if (kind === "biometric") ok = await verifyPaymentsBiometric();
    setBusy(false);
    if (ok) succeed();
    else { setError("Verification failed"); setPin(""); setPwd(""); setAns(""); }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">Payments are locked</CardTitle>
          <CardDescription>Choose a method to unlock.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pin" disabled={!paymentsPinSet}><Lock className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="password" disabled={!paymentsPasswordSet}><KeyRound className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="question" disabled={!paymentsQuestionSet}><HelpCircle className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="biometric" disabled={!paymentsBiometricSet}><Fingerprint className="h-4 w-4" /></TabsTrigger>
            </TabsList>

            <TabsContent value="pin" className="space-y-3 pt-4">
              <Label>PIN</Label>
              <Input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                placeholder="••••" className="text-center text-lg tracking-widest" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={() => trySubmit("pin")} className="w-full" disabled={busy || pin.length < 4}>
                {busy ? "Checking…" : "Unlock"}
              </Button>
            </TabsContent>

            <TabsContent value="password" className="space-y-3 pt-4">
              <Label>Password</Label>
              <Input type="password" value={pwd} onChange={(e) => { setPwd(e.target.value); setError(""); }} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={() => trySubmit("password")} className="w-full" disabled={busy || !pwd}>
                {busy ? "Checking…" : "Unlock"}
              </Button>
            </TabsContent>

            <TabsContent value="question" className="space-y-3 pt-4">
              <Label>{paymentsSecurityQuestion || "Security question"}</Label>
              <Input value={ans} onChange={(e) => { setAns(e.target.value); setError(""); }} placeholder="Your answer" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={() => trySubmit("question")} className="w-full" disabled={busy || !ans.trim()}>
                {busy ? "Checking…" : "Unlock"}
              </Button>
            </TabsContent>

            <TabsContent value="biometric" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">Use your device fingerprint, face, or security key.</p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={() => trySubmit("biometric")} className="w-full" disabled={busy}>
                <Fingerprint className="h-4 w-4 mr-2" />
                {busy ? "Waiting…" : "Use biometric"}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsGuard;
