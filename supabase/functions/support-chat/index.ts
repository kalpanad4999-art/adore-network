// Trinetra Yoga customer support chatbot.
// Verifies customer by phone (scoped to studio owner) and answers questions
// using live data from students, student_payments, batches, instructors,
// live_classes, and studio_settings via Lovable AI Gateway.
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

const normalizePhone = (p: string) => p.replace(/[^\d]/g, "").slice(-10);

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
  const norm = normalizePhone(phone);
  if (norm.length < 7) return null;
  const { data } = await admin
    .from("students")
    .select("id,name,email,phone,membership_type,membership_status,created_at,batch_id")
    .eq("user_id", ownerId);
  if (!data) return null;
  return data.find((s) => normalizePhone(s.phone || "") === norm) ?? null;
}

async function buildCustomerContext(ownerId: string, studentId: string, studentName: string, batchId: string | null) {
  const [paymentsRes, batchRes, settingsRes, classesRes] = await Promise.all([
    admin.from("student_payments")
      .select("amount,paid_on,method,plan,valid_until,duration_months")
      .eq("student_id", studentId).order("paid_on", { ascending: false }).limit(10),
    batchId
      ? admin.from("batches").select("name,description,fee,start_date").eq("id", batchId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("studio_settings").select("studio_name").eq("owner_id", ownerId).maybeSingle(),
    admin.from("live_classes")
      .select("title,scheduled_at,duration_minutes,platform")
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
    membership: {
      plan: latest?.plan || "—",
      renewalDate: latest?.valid_until || null,
      daysRemaining,
      state: membershipState,
      lastPayment: latest || null,
    },
    payments: payments.slice(0, 5),
    upcomingClasses: classesRes.data || [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages : [];
    const phone: string | undefined = body.phone?.trim();
    const ownerId = await resolveOwnerId(body.ownerId, body.batchToken);

    if (!ownerId) return json({ error: "Studio not found" }, 400);
    if (!messages.length) return json({ error: "No messages" }, 400);

    let contextBlock = "";
    let verified = false;
    if (phone) {
      const customer = await findCustomer(ownerId, phone);
      if (!customer) {
        return json({
          reply: "We could not locate your account with that phone number. Please double-check the number you registered with, or contact Trinetra Yoga support.",
        });
      }
      verified = true;
      const ctx = await buildCustomerContext(ownerId, customer.id, customer.name, customer.batch_id);
      contextBlock = `\n\nVERIFIED CUSTOMER DATA (use only this data; never invent facts):\n${JSON.stringify(ctx, null, 2)}`;
    }

    const system = `You are the friendly customer-support assistant for ${verified ? "" : "a "}Trinetra Yoga studio.
Tone: warm, concise, professional. Use short paragraphs and bullet points. Add a 🙏 only in the first greeting.
Rules:
- If the user has NOT yet provided their registered phone number, politely ask for it before sharing any personal info.
- Only answer using the VERIFIED CUSTOMER DATA block when present. Never fabricate membership, payment, attendance, or class details.
- Attendance tracking is not available yet — if asked, say so and offer to share membership/payments/classes instead.
- For renewals: if days remaining <= 7, gently flag expiry and suggest renewing. Show plan, renewal date, days remaining.
- Format dates as e.g. "12 Jun 2026". Amounts in ₹.
- If asked about something outside the data (location, fees for other plans, etc.), suggest contacting the studio directly.${contextBlock}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });

    if (aiRes.status === 429) return json({ error: "Too many requests, please wait a moment." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please contact the studio." }, 402);
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return json({ error: "Information is currently unavailable. Please try again later." }, 500);
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content ?? "I'm sorry, I couldn't generate a response.";
    return json({ reply, verified });
  } catch (e) {
    console.error("support-chat error", e);
    return json({ error: "Information is currently unavailable. Please try again later." }, 500);
  }
});
