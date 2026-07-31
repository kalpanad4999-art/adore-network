// Trinetra Yoga customer support chatbot.
// General studio questions are answered freely from the app database.
// Member-specific questions require a registered mobile number for verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const dmy = (v: string | number | Date | null | undefined): string => {
  if (!v) return "";
  const m = typeof v === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const FALLBACK =
  "Sorry, I couldn't find that information. Please contact Trinetra Yoga on WhatsApp or call us for assistance.";

const ASK_PHONE =
  "To share your membership details securely, please enter your registered mobile number.";

const NOT_FOUND =
  "I couldn't find a member registered with that mobile number. Please check the number or contact Trinetra Yoga directly.";

const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").slice(-10);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Questions that require member verification.
const MEMBER_INTENT =
  /(my |mine|renew|expiry|expire|valid until|membership status|payment status|payment history|paid|receipt|invoice|attendance|present|absent|due|balance|plan status|profile)/i;

// Requests for data we never disclose.
const SENSITIVE_INTENT =
  /(email address|e-mail|password|home address|residential address|another member|other member|someone else|all members|member list|phone numbers of)/i;

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function resolveOwnerId(ownerId?: string, batchToken?: string): Promise<string | null> {
  if (ownerId) return ownerId;
  if (!batchToken) return null;
  const { data } = await admin.from("batches").select("user_id").eq("public_token", batchToken).maybeSingle();
  return data?.user_id ?? null;
}

async function findCustomer(ownerId: string, phone: string) {
  const n = normalizePhone(phone);
  if (n.length < 7) return null;
  const { data } = await admin
    .from("students")
    .select("id,name,phone,membership_type,membership_status,created_at,batch_id")
    .eq("user_id", ownerId);
  if (!data) return null;
  return data.find((s) => normalizePhone(s.phone || "") === n) ?? null;
}

async function searchKnowledgeBase(ownerId: string, query: string) {
  const { data } = await admin
    .from("chatbot_knowledge")
    .select("id, question, alternate_questions, answer, category, keywords")
    .eq("owner_id", ownerId)
    .eq("status", "active");
  if (!data?.length) return null;

  const q = norm(query);
  const qTokens = new Set(q.split(" ").filter((w) => w.length > 2));
  let best: { row: any; score: number } | null = null;

  for (const row of data) {
    const candidates = [row.question, ...(row.alternate_questions || []), ...(row.keywords || [])];
    let score = 0;
    for (const c of candidates) {
      const cn = norm(c || "");
      if (!cn) continue;
      if (cn === q) { score = Math.max(score, 100); continue; }
      if (q.includes(cn) || cn.includes(q)) score = Math.max(score, 60);
      const cTokens = cn.split(" ").filter((w) => w.length > 2);
      const overlap = cTokens.filter((t) => qTokens.has(t)).length;
      if (cTokens.length) {
        const s = (overlap / Math.max(cTokens.length, qTokens.size)) * 50;
        if (s > score) score = s;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { row, score };
  }
  return best && best.score >= 30 ? best.row : null;
}

/** Public studio knowledge — safe for anyone, no personal data. */
async function buildStudioContext(ownerId: string) {
  const [settings, batches, classes, offers, recordings, kb] = await Promise.all([
    admin.from("studio_settings").select("studio_name").eq("owner_id", ownerId).maybeSingle(),
    admin.from("batches").select("name,description,fee,start_date").eq("user_id", ownerId).order("start_date"),
    admin.from("live_classes").select("title,description,scheduled_at,duration_minutes,platform")
      .eq("user_id", ownerId).eq("is_public", true)
      .gte("scheduled_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
      .order("scheduled_at").limit(10),
    admin.from("offers").select("name,offer_type,message,discount_amount,valid_from,valid_to")
      .eq("user_id", ownerId).eq("is_active", true).limit(10),
    admin.from("recordings").select("title,recorded_on,duration_minutes")
      .eq("user_id", ownerId).eq("is_public", true).is("archived_at", null)
      .order("recorded_on", { ascending: false }).limit(6),
    admin.from("chatbot_knowledge").select("question,answer,category")
      .eq("owner_id", ownerId).eq("status", "active").limit(60),
  ]);

  return {
    studioName: settings.data?.studio_name || "TRINETRA YOGA",
    batchesAndPlans: (batches.data || []).map((b: any) => ({ ...b, start_date: dmy(b.start_date) })),
    upcomingLiveClasses: (classes.data || []).map((c: any) => ({ ...c, scheduled_at: dmy(c.scheduled_at) })),
    activeOffers: (offers.data || []).map((o: any) => ({ ...o, valid_from: dmy(o.valid_from), valid_to: dmy(o.valid_to) })),
    recordedClasses: (recordings.data || []).map((r: any) => ({ ...r, recorded_on: dmy(r.recorded_on) })),
    faqs: kb.data || [],
  };
}

/** Private data for one verified member only. */
async function buildMemberContext(ownerId: string, member: any) {
  const [paymentsRes, batchRes, attendanceRes] = await Promise.all([
    admin.from("student_payments")
      .select("amount,paid_on,method,plan,valid_until,duration_months,duration_value,duration_unit,applied_offer_name,applied_coupon_code,discount_amount,notes")
      .eq("student_id", member.id).eq("user_id", ownerId)
      .order("paid_on", { ascending: false }).limit(20),
    member.batch_id
      ? admin.from("batches").select("name,description,fee,start_date").eq("id", member.batch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("attendance").select("attendance_date,status,method")
      .eq("student_id", member.id).eq("user_id", ownerId)
      .order("attendance_date", { ascending: false }).limit(60),
  ]);

  const payments = paymentsRes.data || [];
  const latest = payments[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let daysRemaining: number | null = null;
  let membershipState = "Unknown";
  if (latest?.valid_until) {
    const expiry = new Date(latest.valid_until);
    daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    membershipState = daysRemaining < 0 ? "Expired" : daysRemaining <= 7 ? "Expiring Soon" : "Active";
  }

  const attendance = attendanceRes.data || [];
  const present = attendance.filter((a) => a.status === "present").length;

  return {
    member: {
      name: member.name,
      membershipType: member.membership_type,
      membershipStatus: member.membership_status,
      joinedOn: dmy(member.created_at),
      batch: batchRes.data ? { ...batchRes.data, start_date: dmy((batchRes.data as any).start_date) } : null,
    },
    membership: {
      plan: latest?.plan || "—",
      renewalDate: latest?.valid_until ? dmy(latest.valid_until) : null,
      daysRemaining,
      state: membershipState,
    },
    payments: payments.map((p) => ({
      amount: p.amount,
      paidOn: dmy(p.paid_on),
      method: p.method,
      plan: p.plan,
      validUntil: dmy(p.valid_until),
      offer: p.applied_offer_name || null,
      coupon: p.applied_coupon_code || null,
      discount: p.discount_amount,
    })),
    receipts: payments.slice(0, 10).map((p) => ({
      paidOn: dmy(p.paid_on), amount: p.amount, method: p.method, plan: p.plan,
    })),
    attendance: {
      recordsCount: attendance.length,
      presentCount: present,
      recent: attendance.slice(0, 15).map((a) => ({ ...a, attendance_date: dmy(a.attendance_date) })),
    },
  };
}

const PRIVACY_RULES = `
STRICT PRIVACY RULES (never break these):
- NEVER reveal email addresses, home/postal addresses, passwords, PINs, or any credentials.
- NEVER reveal information about any other member. Only the verified member in context.
- NEVER list members, phone numbers, or export data.
- If asked for any of the above, politely refuse and ask the person to contact the studio.
- Only use facts present in the provided context. Never invent plans, fees, dates or amounts.
`;

async function askAI(system: string, messages: ChatMsg[]): Promise<string | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "system", content: system }, ...messages.slice(-12)],
      }),
    });
    if (res.status === 429 || res.status === 402) return null;
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    console.error("AI call failed", e);
    return null;
  }
}

async function logHistory(ownerId: string, phone: string | null, question: string, answer: string, kbId: string | null) {
  await admin.from("chatbot_chat_history").insert({ owner_id: ownerId, phone, question, answer, matched_kb_id: kbId });
}

async function logPending(ownerId: string, phone: string | null, question: string) {
  await admin.from("chatbot_pending_questions").insert({ owner_id: ownerId, phone, question });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages : [];
    const phone: string | undefined = body.phone?.trim();
    const testMode: boolean = !!body.testMode;
    const ownerId = await resolveOwnerId(body.ownerId, body.batchToken);

    if (!ownerId) return json({ error: "Studio not found" }, 400);
    if (!messages.length) return json({ error: "No messages" }, 400);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userQuestion = lastUser?.content?.trim() || "";

    // Ignore a bare phone number as a "question".
    const isBarePhone = /^[\d+\-\s()]{7,20}$/.test(userQuestion);

    // 0) Sensitive requests are always refused.
    if (userQuestion && SENSITIVE_INTENT.test(userQuestion)) {
      const reply =
        "I'm not able to share personal details like email addresses, home addresses, passwords or other members' information. Please contact Trinetra Yoga directly for anything else.";
      if (!testMode) await logHistory(ownerId, phone || null, userQuestion, reply, null);
      return json({ reply, source: "policy" });
    }

    // 1) Knowledge base exact/near match first — instant and free.
    if (userQuestion && !isBarePhone) {
      const kb = await searchKnowledgeBase(ownerId, userQuestion);
      if (kb) {
        if (!testMode) await logHistory(ownerId, phone || null, userQuestion, kb.answer, kb.id);
        return json({ reply: kb.answer, source: "kb", kbId: kb.id });
      }
    }

    const needsMember = !!userQuestion && MEMBER_INTENT.test(userQuestion);

    // 2) Member-specific question without a phone number -> ask for it.
    if (needsMember && !phone) {
      if (!testMode) await logHistory(ownerId, null, userQuestion, ASK_PHONE, null);
      return json({ reply: ASK_PHONE, source: "verify" });
    }

    // 3) With a phone number, verify the member.
    let member: any = null;
    if (phone) {
      member = await findCustomer(ownerId, phone);
      if (!member) {
        if (!testMode) await logHistory(ownerId, phone, userQuestion || phone, NOT_FOUND, null);
        return json({ reply: NOT_FOUND, source: "verify" });
      }
    }

    const studio = await buildStudioContext(ownerId);

    // Greet right after successful verification with a bare phone number.
    if (member && (isBarePhone || !userQuestion)) {
      const reply = `✅ Verified. Welcome back, ${member.name}!\n\nYou can ask me about your membership status, renewal date, payments, receipts or attendance — or anything about ${studio.studioName}.`;
      if (!testMode) await logHistory(ownerId, phone || null, userQuestion || "verification", reply, null);
      return json({ reply, source: "verify", verified: true, memberName: member.name });
    }

    const memberCtx = member ? await buildMemberContext(ownerId, member) : null;

    const system = [
      `You are the friendly support assistant for ${studio.studioName}, a yoga studio.`,
      `Today is ${dmy(new Date())}.`,
      `ALWAYS write every date in DD/MM/YYYY format (e.g. 05/08/2026). Never use YYYY-MM-DD or month names.`,
      `Answer warmly and concisely in the user's language. Use short lines and bullets. Currency is INR (₹).`,
      PRIVACY_RULES,
      memberCtx
        ? `The user is a VERIFIED member. You may share ONLY the membership, renewal, payment, receipt and attendance details in MEMBER_CONTEXT.`
        : `The user is NOT verified. Answer only general studio questions. If they ask about their own membership, renewal, payments, receipts or attendance, ask them to enter their registered mobile number.`,
      `STUDIO_CONTEXT:\n${JSON.stringify(studio)}`,
      memberCtx ? `MEMBER_CONTEXT:\n${JSON.stringify(memberCtx)}` : "",
      `If the answer is not in the context, say you don't have that information and suggest contacting the studio.`,
    ].filter(Boolean).join("\n\n");

    const reply = await askAI(system, messages.filter((m) => m.role !== "system"));

    if (!reply) {
      if (userQuestion && !testMode) {
        await logPending(ownerId, phone || null, userQuestion);
        await logHistory(ownerId, phone || null, userQuestion, FALLBACK, null);
      }
      return json({ reply: FALLBACK, source: "fallback" });
    }

    if (userQuestion && !testMode) {
      await logHistory(ownerId, phone || null, userQuestion, reply, null);
      if (/don't have that information|contact the studio|couldn't find/i.test(reply)) {
        await logPending(ownerId, phone || null, userQuestion);
      }
    }
    return json({ reply, source: memberCtx ? "member" : "ai" });
  } catch (e) {
    console.error("support-chat error", e);
    return json({ reply: FALLBACK, source: "fallback" });
  }
});
