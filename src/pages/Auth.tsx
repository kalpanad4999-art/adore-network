import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);
const phoneSchema = z
  .string()
  .trim()
  .min(6, "Please enter a valid phone number")
  .max(30)
  .regex(/^[0-9+\-\s()]+$/, "Please enter a valid phone number");
const nameSchema = z.string().trim().min(2, "Please enter your full name").max(80);

const WEAK_PW_MSG = "Password is too weak. Please use at least 4 characters.";

const isEmail = (v: string) => /@/.test(v);

const friendlyAuthError = (err: any): string => {
  const msg = (err?.message || "").toLowerCase();
  const code = (err?.code || err?.name || "").toLowerCase();
  if (!navigator.onLine) return "You appear to be offline. Check your connection and try again.";
  if (code.includes("email_not_confirmed") || msg.includes("email not confirmed"))
    return "Your email isn't confirmed yet. Check your inbox for the confirmation link, or resend it below.";
  if (msg.includes("invalid login") || msg.includes("invalid credentials"))
    return "Incorrect credentials. Please try again.";
  if (msg.includes("user already registered") || msg.includes("already registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (code.includes("over_email_send_rate_limit") || msg.includes("rate limit"))
    return "Too many attempts. Please wait a few seconds and try again.";
  if (msg.includes("network") || msg.includes("failed to fetch"))
    return "Network error. Please check your connection and retry.";
  if (msg.includes("password") && msg.includes("weak")) return WEAK_PW_MSG;
  return err?.message || "Something went wrong. Please try again.";
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState(""); // email OR phone (login)
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  const resolveEmailFromIdentifier = async (raw: string): Promise<string | null> => {
    const v = raw.trim();
    if (!v) return null;
    if (isEmail(v)) {
      const r = emailSchema.safeParse(v);
      return r.success ? r.data : null;
    }
    const r = phoneSchema.safeParse(v);
    if (!r.success) return null;
    const { data, error } = await supabase.rpc("get_email_by_phone", { _phone: r.data });
    if (error) return null;
    return (data as string | null) ?? null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowResend(false);

    if (password.length < 4) {
      toast.error(WEAK_PW_MSG);
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        if (!identifier.trim()) {
          toast.error("Enter your email or phone number");
          return;
        }
        const resolvedEmail = await resolveEmailFromIdentifier(identifier);
        if (!resolvedEmail) {
          toast.error("No account found for that email or phone number");
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password,
        });
        if (error) {
          if ((error as any).code === "email_not_confirmed" || /email not confirmed/i.test(error.message)) {
            setEmail(resolvedEmail);
            setShowResend(true);
          }
          throw error;
        }
        toast.success("Welcome back!");
        navigate("/", { replace: true });
      } else {
        const nameResult = nameSchema.safeParse(fullName);
        if (!nameResult.success) { toast.error(nameResult.error.issues[0].message); return; }
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) { toast.error(emailResult.error.issues[0].message); return; }
        const phoneResult = phoneSchema.safeParse(phone);
        if (!phoneResult.success) { toast.error(phoneResult.error.issues[0].message); return; }

        const { data, error } = await supabase.auth.signUp({
          email: emailResult.data,
          password,
          options: {
            data: { full_name: fullName.trim(), phone: phoneResult.data },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created!");
          navigate("/", { replace: true });
        } else {
          toast.success("Account created. Check your email to confirm your account.");
          setIsLogin(true);
          setIdentifier(emailResult.data);
        }
      }
    } catch (error: any) {
      toast.error(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(friendlyAuthError(result.error));
        return;
      }
      if (result.redirected) return;
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(friendlyAuthError(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const target = (email || identifier).trim();
    const emailResult = emailSchema.safeParse(target);
    if (!emailResult.success) { toast.error("Enter your email first"); return; }
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailResult.data,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success("Confirmation email resent. Please check your inbox.");
    } catch (error: any) {
      toast.error(friendlyAuthError(error));
    }
  };

  const handleForgotPassword = async () => {
    const target = identifier.trim();
    let targetEmail = target;
    if (target && !isEmail(target)) {
      const resolved = await resolveEmailFromIdentifier(target);
      if (!resolved) { toast.error("Enter your email address for password reset"); return; }
      targetEmail = resolved;
    }
    const emailResult = emailSchema.safeParse(targetEmail);
    if (!emailResult.success) { toast.error("Please enter your email address first"); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailResult.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent!");
    } catch (error: any) {
      toast.error(friendlyAuthError(error));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">TRINETRA YOGA</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isLogin ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription>
              {isLogin ? "Sign in with email or phone number" : "Start managing your yoga business"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
            >
              {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.07-1.1-.15-1.6H12z"/>
                </svg>
              )}
              Continue with Google
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {!isLogin ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" required disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" required disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" inputMode="tel" required disabled={loading} />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or Phone Number</Label>
                  <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or +91 98765 43210" autoComplete="username" required disabled={loading} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    minLength={4}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <button type="button" onClick={handleForgotPassword} className="text-sm text-primary hover:underline" disabled={loading}>
                  Forgot password?
                </button>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : isLogin ? "Sign In" : "Sign Up"}
              </Button>

              {showResend && isLogin && (
                <Button type="button" variant="outline" className="w-full" onClick={handleResendConfirmation} disabled={loading}>
                  Resend confirmation email
                </Button>
              )}
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => { setIsLogin(!isLogin); setShowResend(false); }}
                className="text-sm text-muted-foreground hover:text-foreground"
                disabled={loading}
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
