import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const OWNED_TABLES = [
  "students",
  "batches",
  "student_payments",
  "expenses",
  "instructors",
  "locations",
  "gallery_items",
  "recordings",
  "live_classes",
];

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
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Missing auth" }, 401);

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);
    const caller = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ── check email ────────────────────────────────────
    if (action === "check_email") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json({ error: "Email required" }, 400);
      const { data } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .ilike("email", email)
        .maybeSingle();
      if (!data) return json({ exists: false });
      return json({ exists: true, user: { id: data.id, full_name: data.full_name, email: data.email } });
    }

    // ── transfer ownership ─────────────────────────────
    if (action === "transfer") {
      const currentEmail = String(body.currentEmail || "").trim().toLowerCase();
      const currentPassword = String(body.currentPassword || "");
      const targetEmail = String(body.targetEmail || "").trim().toLowerCase();
      const createNew = !!body.createNew;
      const newUser = body.newUser || {};

      if (!currentEmail || !currentPassword || !targetEmail) {
        return json({ error: "Missing required fields" }, 400);
      }
      if (caller.email?.toLowerCase() !== currentEmail) {
        return json({ error: "Current email does not match your account" }, 400);
      }
      if (currentEmail === targetEmail) {
        return json({ error: "New owner must be a different account" }, 400);
      }

      // Verify caller is currently an owner
      const { data: callerRole } = await admin
        .from("user_roles")
        .select("role, owner_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!callerRole || callerRole.role !== "owner") {
        return json({ error: "Only the studio owner can transfer ownership" }, 403);
      }

      // Re-verify password
      const verifyClient = createClient(SUPABASE_URL, ANON_KEY);
      const { error: pwErr } = await verifyClient.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword,
      });
      if (pwErr) return json({ error: "Incorrect current password" }, 401);

      // Resolve or create target user
      let targetId: string | null = null;
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .ilike("email", targetEmail)
        .maybeSingle();

      if (existingProfile) {
        targetId = existingProfile.id;
      } else {
        if (!createNew) return json({ error: "No account found with this email" }, 404);
        const fullName = String(newUser.fullName || "").trim();
        const phone = String(newUser.phone || "").trim();
        const password = String(newUser.password || "");
        if (fullName.length < 2) return json({ error: "Full name required" }, 400);
        if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: targetEmail,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, phone },
        });
        if (cErr || !created.user) return json({ error: cErr?.message || "Could not create account" }, 400);
        targetId = created.user.id;

        // Update profile with phone
        await admin.from("profiles").update({ full_name: fullName, phone }).eq("id", targetId);
      }

      if (!targetId) return json({ error: "Unable to resolve target user" }, 500);
      const OLD = caller.id;
      const NEW = targetId;

      // Guard: target must not already own a different studio with data
      const { data: targetRole } = await admin
        .from("user_roles")
        .select("role, owner_id")
        .eq("user_id", NEW)
        .maybeSingle();
      if (targetRole?.role === "owner" && targetRole.owner_id !== NEW && targetRole.owner_id !== OLD) {
        return json({ error: "Target user already owns another studio" }, 400);
      }

      // Reassign business data
      for (const table of OWNED_TABLES) {
        const { error } = await admin.from(table).update({ user_id: NEW }).eq("user_id", OLD);
        if (error) return json({ error: `Failed reassigning ${table}: ${error.message}` }, 500);
      }

      // Transfer studio_settings & studio_security (drop any placeholder rows for NEW first)
      await admin.from("studio_settings").delete().eq("owner_id", NEW);
      await admin.from("studio_settings").update({ owner_id: NEW }).eq("owner_id", OLD);
      await admin.from("studio_security").delete().eq("owner_id", NEW);
      await admin.from("studio_security").update({ owner_id: NEW }).eq("owner_id", OLD);

      // Move any staff under OLD to NEW
      await admin
        .from("user_roles")
        .update({ owner_id: NEW })
        .eq("owner_id", OLD)
        .eq("role", "staff");

      // Old owner becomes staff of NEW
      await admin.from("user_roles").delete().eq("user_id", OLD);
      await admin.from("user_roles").insert({ user_id: OLD, owner_id: NEW, role: "staff" });

      // Ensure NEW is owner of self
      await admin.from("user_roles").delete().eq("user_id", NEW);
      await admin.from("user_roles").insert({ user_id: NEW, owner_id: NEW, role: "owner" });

      // Audit
      const device = req.headers.get("user-agent")?.slice(0, 180) || "unknown";
      await admin.from("payment_audit_logs").insert({
        owner_id: NEW,
        user_id: OLD,
        action: "ownership.transferred",
        details: {
          previous_owner: OLD,
          previous_email: currentEmail,
          new_owner: NEW,
          new_email: targetEmail,
          created_new_account: !existingProfile,
        },
        device,
      });

      return json({ success: true, newOwnerId: NEW });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("transfer-ownership error", e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
