import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useStudio } from "@/contexts/StudioContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";

/**
 * Blocks any signed-in account that has no role in the workspace.
 * A role is only granted by accepting an Owner invitation (or by being the
 * very first account in an empty workspace). Backend RLS enforces the same.
 */
const AuthorizationGate = ({ children }: { children: ReactNode }) => {
  const { authorized, loading } = useStudio();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse font-display text-2xl text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (authorized) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl">You are not authorized</CardTitle>
          <CardDescription>
            This studio workspace is invitation-only. Ask the Studio Owner to send an invitation to
            {user?.email ? ` ${user.email}` : " your email address"}, then open the Accept Invitation link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => navigate("/", { replace: true })}>
            Try again
          </Button>
          <Button variant="ghost" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthorizationGate;
