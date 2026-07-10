import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const emailSchema = z.string().trim().email("Please enter a valid email address").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72, "Password is too long");
const nameSchema = z.string().trim().min(2, "Please enter your full name").max(80);

const friendlyAuthError = (err: any): string => {
  const msg = (err?.message || "").toLowerCase();
  const code = (err?.code || err?.name || "").toLowerCase();
  if (!navigator.onLine) return "You appear to be offline. Check your connection and try again.";
  if (code.includes("email_not_confirmed") || msg.includes("email not confirmed"))
    return "Your email isn't confirmed yet. Check your inbox for the confirmation link, or resend it below.";
  if (msg.includes("invalid login") || msg.includes("invalid credentials"))
    return "Incorrect email or password. Please try again.";
  if (msg.includes("user already registered") || msg.includes("already registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (code.includes("over_email_send_rate_limit") || msg.includes("rate limit"))
    return "Too many attempts. Please wait a few seconds and try again.";
  if (msg.includes("network") || msg.includes("failed to fetch"))
    return "Network error. Please check your connection and retry.";
  return err?.message || "Something went wrong. Please try again.";
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowResend(false);

    // Validate
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.issues[0].message);
      return;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.issues[0].message);
      return;
    }
    if (!isLogin) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        toast.error(nameResult.error.issues[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailResult.data,
          password: passwordResult.data,
        });
        if (error) {
          if ((error as any).code === "email_not_confirmed" || /email not confirmed/i.test(error.message)) {
            setShowResend(true);
          }
          throw error;
        }
        toast.success("Welcome back!");
        navigate("/", { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailResult.data,
          password: passwordResult.data,
          options: {
            data: { full_name: fullName.trim() },
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
        }
      }
    } catch (error: any) {
      toast.error(friendlyAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error("Enter your email first");
      return;
    }
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
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error("Please enter your email address first");
      return;
    }
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
              {isLogin ? "Sign in to manage your studio" : "Start managing your yoga business"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    required={!isLogin}
                    disabled={loading}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                    minLength={6}
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
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-primary hover:underline"
                  disabled={loading}
                >
                  Forgot password?
                </button>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : isLogin ? (
                  "Sign In"
                ) : (
                  "Sign Up"
                )}
              </Button>

              {showResend && isLogin && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendConfirmation}
                  disabled={loading}
                >
                  Resend confirmation email
                </Button>
              )}
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setShowResend(false);
                }}
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
