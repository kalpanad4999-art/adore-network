import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const ownerId = String(body.ownerId || "").trim();
    const name = String(body.name || "").trim().slice(0, 100);
    const phone = String(body.phone || "").trim().slice(0, 20);
    const email = String(body.email || "").trim().slice(0, 255);
    const notes = String(body.notes || "").trim().slice(0, 500);

    if (!/^[0-9a-f-]{36}$/i.test(ownerId)) {
      return new Response(JSON.stringify({ error: "Invalid studio link" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!name) return new Response(JSON.stringify({ error: "Name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!phoneRegex.test(phone)) return new Response(JSON.stringify({ error: "Valid phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("students").insert({
      user_id: ownerId,
      name,
      phone,
      email: email || null,
      notes: notes || null,
      membership_type: "drop-in",
      membership_status: "active",
    });

    if (error) {
      console.error("Insert failed", error);
      return new Response(JSON.stringify({ error: "Could not register" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "Bad request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
