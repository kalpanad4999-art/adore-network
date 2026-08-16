import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!phone || phone.length > 30 || !/^[0-9+\-\s()]+$/.test(phone) || !password || password.length > 200) {
      return json({ error: "Invalid credentials" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const digits = phone.replace(/[^0-9]/g, "");

    // Resolve the account email server-side only — never returned to the caller.
    const { data: profiles, error: lookupError } = await admin
      .from("profiles")
      .select("email, phone")
      .not("email", "is", null)
      .limit(2000);

    if (lookupError) {
      console.error("phone-login lookup failed", lookupError.message);
      return json({ error: "Sign-in failed. Please try again." }, 500);
    }

    const match = (profiles ?? []).find(
      (p: { email: string | null; phone: string | null }) =>
        p.phone && (p.phone.trim() === phone || p.phone.replace(/[^0-9]/g, "") === digits),
    );

    // Generic response so a phone number alone never confirms account existence.
    if (!match?.email) return json({ error: "Incorrect credentials. Please try again." }, 400);

    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: match.email, password });

    if (error || !data.session) {
      const code = (error as { code?: string } | null)?.code ?? "";
      if (code === "email_not_confirmed" || /email not confirmed/i.test(error?.message ?? "")) {
        return json({ error: "Your email isn't confirmed yet. Sign in with your email address to resend it.", code }, 400);
      }
      return json({ error: "Incorrect credentials. Please try again." }, 400);
    }

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (e) {
    console.error("phone-login error", e instanceof Error ? e.message : String(e));
    return json({ error: "Sign-in failed. Please try again." }, 500);
  }
});
