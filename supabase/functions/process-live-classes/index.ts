// Auto-converts ended live classes into recordings and archives expired
// recordings. Safe to invoke on a cron or manually by an authenticated caller.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Only the scheduler (shared secret) or an authenticated studio user may run
    // this cross-tenant maintenance job.
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    let allowed = CRON_SECRET.length > 0 && cronHeader === CRON_SECRET;

    if (!allowed) {
      const auth = req.headers.get("Authorization") ?? "";
      const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
      if (token) {
        const authClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data, error } = await authClient.auth.getUser(token);
        if (!error && data?.user?.id) {
          const { data: role } = await authClient
            .from("user_roles").select("role").eq("user_id", data.user.id).maybeSingle();
          allowed = !!role;
        }
      }
    }

    if (!allowed) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.rpc("process_live_class_lifecycle");
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
