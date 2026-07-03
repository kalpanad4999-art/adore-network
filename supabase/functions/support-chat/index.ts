// Trinetra Yoga customer support chatbot.
// Verifies customer by phone, searches the owner's knowledge base first,
// falls back to AI with customer context, logs history + pending questions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").slice(-10);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

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
    .select("id,name,email,phone,membership_type,membership_status,created_at,batch_id")
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

async function buildCustomerContext(ownerId: string, studentId: string, studentName: string, batchId: string | null) {
  const [paymentsRes, batchRes, settingsRes, classesRes] = await Promise.all([
    admin.from("student_payments").select("amount,paid_on,method,plan,valid_until,duration_months")
      .eq("student_id", studentId).order("paid_on", { ascending: false }).limit(10),
    batchId ? admin.from("batches").select("name,description,fee,start_date").eq("id", batchId).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("studio_settings").select("studio_name").eq("owner_id", ownerId).maybeSingle(),
    admin.from("live_classes").select("title,scheduled_at,duration_minutes,platform")
      .eq("user_id", ownerId).eq("is_public", true)
      .gte("scheduled_at", new Date(Date.now() - 2 * 3600 * 1000).toISOString())
      .order("scheduled_at").limit(8),
  ]);

  const payments = paymentsRes.data || [];
  const latest = payments[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let daysRemaining: number | null = null;
  let membershipState = "Unknown";
  if (latest?.valid_until) {
    const expiry = new Date(latest.valid_until);
    daysRemaining = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
    if (daysRemaining < 0) membershipState = "Expired";
    else if (daysRemaining <= 7) membershipState = "Expiring Soon";
    else membershipState = "Active";
  }

  return {
    studioName: settingsRes.data?.studio_name || "Trinetra Yoga",
    customer: { name: studentName, batch: batchRes.data },
    membership: { plan: latest?.plan || "—", renewalDate: latest?.valid_until || null, daysRemaining, state: membershipState, lastPayment: latest || null },
    payments: payments.slice(0, 5),
    upcomingClasses: classesRes.data || [],
  };
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

    // 1) Knowledge base first — works with or without phone.
    if (userQuestion) {
      const kb = await searchKnowledgeBase(ownerId, userQuestion);
      if (kb) {
        if (!testMode) await logHistory(ownerId, phone || null, userQuestion, kb.answer, kb.id);
        return json({ reply: kb.answer, source: "kb", kbId: kb.id });
      }
    }

    // 2) Customer context path (requires phone) — used for personal data questions.
    let contextBlock = "";
    let verified = false;
    if (phone) {
      const customer = await findCustomer(ownerId, phone);
      if (!customer) {
        const reply = "We could not locate your account with that phone number. Please double-check the number you registered with, or contact Trinetra Yoga support.";
        return json({ reply });
      }
      verified = true;
      const ctx = await buildCustomerContext(ownerId, customer.id, customer.name, customer.batch_id);
      contextBlock = `\n\nVERIFIED CUSTOMER DATA (use only this data; never invent facts):\n${JSON.stringify(ctx, null, 2)}`;
    }

    // 3) If no phone and KB missed, log as pending and return fallback.
    if (!phone) {
      if (userQuestion && !testMode) {
        await logPending(ownerId, null, userQuestion);
        await logHistory(ownerId, null, userQuestion, FALLBACK, null);
      }
      return json({ reply: FALLBACK, source: "fallback" });
    }

    const system = `You are the friendly customer-support assistant for a Trinetra Yoga studio.
Tone: warm, concise, professional. Short paragraphs and bullet points.
Rules:
- Only answer using the VERIFIED CUSTOMER DATA block. Never fabricate membership, payment, attendance, or class details.
- Attendance tracking is not available yet — say so if asked.
- For renewals: if days remaining <= 7, flag expiry and suggest renewing.
- Format dates like "12 Jun 2026". Amounts in ₹.
- If the answer is not in the data, reply exactly: "${FALLBACK}"${contextBlock}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (aiRes.status === 429) return json({ error: "Too many requests, please wait a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please contact the studio." }, 402);
    if (!aiRes.ok) {
      console.error("AI gateway error", aiRes.status, await aiRes.text());
      return json({ reply: FALLBACK, source: "fallback" });
    }

    const data = await aiRes.json();
    let reply: string = data.choices?.[0]?.message?.content?.trim() || FALLBACK;

    const isFallback = norm(reply).includes(norm(FALLBACK).slice(0, 40));
    if (userQuestion && !testMode) {
      await logHistory(ownerId, phone || null, userQuestion, reply, null);
      if (isFallback) await logPending(ownerId, phone || null, userQuestion);
    }
    return json({ reply, verified, source: isFallback ? "fallback" : "ai" });
  } catch (e) {
    console.error("support-chat error", e);
    return json({ reply: FALLBACK, source: "fallback" });
  }
});
