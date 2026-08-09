// Ownership-transfer helper.
// Lets the current Owner check whether an account exists for an email and,
// optionally, create a confirmed account that joins the workspace as Staff so
// the existing transfer_ownership RPC can hand ownership to it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const shouldCreate = body?.create === true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Invalid email address" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Identify the caller from their JWT.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Not authenticated" }, 401);

    // Only the current Owner may use this.
    const { data: ownerRow } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerRow) return json({ error: "Only the Owner can transfer ownership" }, 403);

    // Look up the account by email.
    const { data: page } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const found = page?.users?.find((u) => (u.email || "").toLowerCase() === email);

    if (found && found.id === caller.id) {
      return json({ error: "You are already the Owner" }, 400);
    }

    if (!found && !shouldCreate) {
      return json({ exists: false });
    }

    let userId = found?.id as string | undefined;
    let created = false;

    if (!found) {
      // Confirmed account with a random password — the new Owner sets their own
      // password later via "Forgot Password" on the login page.
      const password = `${crypto.randomUUID()}Aa1!`;
      const { data: cu, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !cu?.user) {
        return json({ error: cErr?.message || "Could not create the account" }, 500);
      }
      userId = cu.user.id;
      created = true;
    }

    // Ensure the account belongs to this workspace as Staff (required by the
    // transfer_ownership RPC). Staff permissions row is created by trigger.
    const { error: roleErr } = await admin
      .from("user_roles")
      .upsert(
        { user_id: userId, owner_id: caller.id, role: "staff" },
        { onConflict: "user_id" }
      );
    if (roleErr) return json({ error: roleErr.message }, 500);

    return json({ exists: true, user_id: userId, created });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Unexpected error" }, 500);
  }
});
