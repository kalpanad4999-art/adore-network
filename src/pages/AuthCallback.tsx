import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/;

const readNext = (): string => {
  try {
    const stored = sessionStorage.getItem("post_auth_redirect");
    if (stored && SAFE_PATH.test(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "/";
};

/**
 * Public OAuth landing route. Providers redirect here after sign-in.
 * It waits for the Supabase session to hydrate (implicit hash tokens or PKCE
 * code exchange) and then sends the user to their intended page.
 * It must never 404 and must never be behind an auth guard.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    let done = false;

    const finish = (path: string) => {
      if (done) return;
      done = true;
      try {
        sessionStorage.removeItem("post_auth_redirect");
      } catch {
        /* ignore */
      }
      navigate(path, { replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(readNext());
    });

    (async () => {
      const url = new URL(window.location.href);
      const errDesc =
        url.searchParams.get("error_description") ||
        new URLSearchParams(url.hash.replace(/^#/, "")).get("error_description");

      if (errDesc) {
        setMessage(errDesc);
        setTimeout(() => finish("/auth"), 1500);
        return;
      }

      // PKCE flow: exchange ?code= for a session.
      const code = url.searchParams.get("code");
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch {
          /* fall through to session check */
        }
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        finish(readNext());
        return;
      }

      // Give the SDK a moment to persist tokens from the URL hash.
      setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        finish(retry.session ? readNext() : "/auth");
      }, 2000);
    })();

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
