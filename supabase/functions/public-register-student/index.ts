import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const mode = String(body.mode || "owner"); // "owner" | "batch" | "lookup"
    const name = String(body.name || "").trim().slice(0, 100);
    const phone = String(body.phone || "").trim().slice(0, 20);
    const email = String(body.email || "").trim().slice(0, 255);
    const address = String(body.address || "").trim().slice(0, 300);
    const notes = String(body.notes || "").trim().slice(0, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup batch info (used by Join page to show batch name / closed state)
    if (mode === "lookup") {
      const token = String(body.token || "").trim();
      if (!token) return json({ error: "Missing token" }, 400);
      const { data: batch } = await supabase
        .from("registration_batches")
        .select("id, name, is_open, owner_id")
        .eq("token", token)
        .maybeSingle();
      if (!batch) return json({ error: "Invalid link" }, 404);
      return json({ name: batch.name, is_open: batch.is_open });
    }

    // Validate registration inputs
    if (!name) return json({ error: "Name required" }, 400);
    if (!phoneRegex.test(phone)) return json({ error: "Valid phone required" }, 400);

    let ownerId: string | null = null;
    let batchId: string | null = null;

    if (mode === "batch") {
      const token = String(body.token || "").trim();
      if (!token) return json({ error: "Missing batch token" }, 400);
      const { data: batch } = await supabase
        .from("registration_batches")
        .select("id, owner_id, is_open")
        .eq("token", token)
        .maybeSingle();
      if (!batch) return json({ error: "Invalid link" }, 404);
      if (!batch.is_open) return json({ error: "This batch is closed" }, 403);
      ownerId = batch.owner_id;
      batchId = batch.id;
    } else {
      ownerId = String(body.ownerId || "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return json({ error: "Invalid studio link" }, 400);
    }

    const noteParts = [address ? `Address: ${address}` : "", notes].filter(Boolean);
    const { error } = await supabase.from("students").insert({
      user_id: ownerId,
      name,
      phone,
      email: email || null,
      address: address || null,
      notes: noteParts.join("\n") || null,
      membership_type: "drop-in",
      membership_status: "active",
    });

    if (error) {
      console.error("Insert failed", error);
      return json({ error: "Could not register" }, 500);
    }

    if (batchId) {
      await supabase.rpc("noop"); // placeholder – ignore if missing
      await supabase
        .from("registration_batches")
        .update({ registrations_count: (await supabase.from("registration_batches").select("registrations_count").eq("id", batchId).maybeSingle()).data?.registrations_count + 1 || 1 })
        .eq("id", batchId);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Bad request" }, 400);
  }
});
