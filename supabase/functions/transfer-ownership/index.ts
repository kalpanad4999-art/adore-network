// Transfer studio ownership from current owner to a new (or existing) user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tables whose rows belong to a studio owner. Second field is the FK column
// used on that table — most legacy tables use `user_id`, newer ones use `owner_id`.
const OWNED_TABLES: Array<[string, "user_id" | "owner_id"]> = [
  ["students", "user_id"],
  ["batches", "user_id"],
  ["student_payments", "user_id"],
  ["expenses", "user_id"],
  ["instructors", "user_id"],
  ["locations", "user_id"],
  ["gallery_items", "user_id"],
  ["recordings", "user_id"],
  ["live_classes", "user_id"],
  ["attendance", "user_id"],
  ["biometric_devices", "user_id"],
  ["offers", "user_id"],
  ["coupons", "user_id"],
  ["offer_redemptions", "user_id"],
  ["chatbot_knowledge", "owner_id"],
  ["chatbot_pending_questions", "owner_id"],
  ["chatbot_chat_history", "owner_id"],
  ["payment_audit_logs", "owner_id"],
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
    if (!token) {
      console.error("transfer-ownership: missing auth header");
      return json({ error: "You must be signed in" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      console.error("transfer-ownership: invalid session", userErr);
      return json({ error: "Session expired. Please sign in again." }, 401);
    }
    const caller = userData.user;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    console.log("transfer-ownership action:", action, "by", caller.email);

    // ── check email ────────────────────────────────────
    if (action === "check_email") {
      // Only the current studio owner may enumerate accounts, to prevent
      // any signed-in user (incl. staff) from harvesting emails / names.
      const { data: callerRoleCheck } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!callerRoleCheck || callerRoleCheck.role !== "owner") {
        return json({ error: "Only the studio owner can look up accounts" }, 403);
      }

      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return json({ error: "Email is required" }, 400);

      // Look up via auth admin so we catch users without a profile row
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) {
        console.error("listUsers failed", listErr);
        return json({ error: "Could not look up user" }, 500);
      }
      const found = list.users.find((u) => (u.email || "").toLowerCase() === email);
      if (!found) return json({ exists: false });

      const { data: prof } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", found.id)
        .maybeSingle();

      return json({
        exists: true,
        user: {
          id: found.id,
          full_name: prof?.full_name ?? (found.user_metadata as any)?.full_name ?? null,
          email: found.email,
        },
      });
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
      if (pwErr) {
        console.warn("password re-verify failed", pwErr.message);
        return json({ error: "Incorrect current password" }, 401);
      }

      // Resolve or create target user via auth admin
      let targetId: string | null = null;
      let createdNewAccount = false;

      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existingAuth = list?.users.find(
        (u) => (u.email || "").toLowerCase() === targetEmail,
      );

      if (existingAuth) {
        targetId = existingAuth.id;
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
        if (cErr || !created.user) {
          console.error("createUser failed", cErr);
          return json({ error: cErr?.message || "Could not create account" }, 400);
        }
        targetId = created.user.id;
        createdNewAccount = true;

        await admin.from("profiles").upsert({
          id: targetId,
          email: targetEmail,
          full_name: fullName,
          phone,
        });
      }

      if (!targetId) return json({ error: "Unable to resolve target user" }, 500);
      const OLD = caller.id;
      const NEW = targetId;

      // Reassign business data
      for (const table of OWNED_TABLES) {
        const { error } = await admin.from(table).update({ user_id: NEW }).eq("user_id", OLD);
        if (error) {
          console.error(`reassign ${table} failed`, error);
          return json({ error: `Failed reassigning ${table}: ${error.message}` }, 500);
        }
      }

      // Transfer studio_settings & studio_security
      await admin.from("studio_settings").delete().eq("owner_id", NEW);
      await admin.from("studio_settings").update({ owner_id: NEW }).eq("owner_id", OLD);
      await admin.from("studio_security").delete().eq("owner_id", NEW);
      await admin.from("studio_security").update({ owner_id: NEW }).eq("owner_id", OLD);

      // Move any staff under OLD to NEW
      await admin.from("user_roles").update({ owner_id: NEW }).eq("owner_id", OLD).eq("role", "staff");

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
          created_new_account: createdNewAccount,
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
