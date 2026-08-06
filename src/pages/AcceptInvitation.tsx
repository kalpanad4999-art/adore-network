import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const PENDING_INVITE_KEY = "trinetra.pending_invite_token";

type Preview = {
  email: string | null;
  studio_name: string | null;
  invited_at: string | null;
  expires_at: string | null;
  status: string;
};

const AcceptInvitation = () => {
  const { token: routeToken } = useParams<{ token?: string }>();
  const [params] = useSearchParams();
  const token = routeToken || params.get("token") || "";
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data, error } = await supabase.rpc("get_invitation_preview", { _token: token });
      if (error) { setLoading(false); return; }
      setPreview(((data as any[]) ?? [])[0] ?? null);
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    if (!user) {
      localStorage.setItem(PENDING_INVITE_KEY, token);
      navigate("/auth", { replace: true });
      return;
    }
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_staff_invitation", { _token: token });
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    localStorage.removeItem(PENDING_INVITE_KEY);
    const status = ((data as any[]) ?? [])[0]?.status;
    if (status === "already_owner") {
      toast.info("You are already the Owner of this workspace.");
      navigate("/", { replace: true });
      return;
    }
    setDone(true);
    toast.success("Invitation accepted — welcome to the studio!");
    setTimeout(() => window.location.replace("/"), 1200);
  };

  // Auto-accept once the invited person signs in.
  useEffect(() => {
    if (!authLoading && user && preview?.status === "pending" && !accepting && !done) {
      const sameEmail = (user.email || "").toLowerCase() === (preview.email || "").toLowerCase();
      if (sameEmail) accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, preview]);

  const invalid = !token || !preview || preview.status === "invalid";
  const statusMessage: Record<string, string> = {
    revoked: "This invitation has been revoked by the Studio Owner.",
    accepted: "This invitation has already been used.",
    expired: "This invitation link has expired. Ask the Owner to send a new one.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            {done ? <CheckCircle2 className="h-6 w-6" /> : invalid ? <ShieldAlert className="h-6 w-6" /> : <MailCheck className="h-6 w-6" />}
          </div>
          <CardTitle className="font-display text-2xl">
            {done ? "You're in!" : `Join ${preview?.studio_name || "TRINETRA YOGA"}`}
          </CardTitle>
          <CardDescription>
            {loading
              ? "Checking your invitation…"
              : invalid
              ? "This invitation link is not valid."
              : preview!.status !== "pending"
              ? statusMessage[preview!.status]
              : `You've been invited to join the studio workspace as Staff${preview?.email ? ` using ${preview.email}` : ""}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : done ? (
            <p className="text-sm text-center text-muted-foreground">Taking you to the studio…</p>
          ) : !invalid && preview!.status === "pending" ? (
            <>
              {user && (user.email || "").toLowerCase() !== (preview!.email || "").toLowerCase() && (
                <p className="text-sm text-destructive text-center">
                  You are signed in as {user.email}. Sign in with {preview!.email} to accept this invitation.
                </p>
              )}
              <Button className="w-full" onClick={accept} disabled={accepting}>
                {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {user ? "Accept Invitation" : "Sign in to accept"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No account yet? Create one with {preview!.email} and the invitation will be applied automatically.
              </p>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              Go to sign in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
