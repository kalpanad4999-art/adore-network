import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, RefreshCw, CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Customer { id: string; name: string; phone: string | null; }
interface Payment {
  id: string;
  student_id: string;
  amount: number;
  paid_on: string;
  duration_months: number | null;
  valid_until: string | null;
  reminder_sent_at: string | null;
}

type Status = "active" | "due_soon" | "due_today" | "expired" | "renewed";

interface Renewal {
  customer: Customer;
  latest: Payment | null;
  previous: Payment | null;
  renewalDate: string | null;
  daysRemaining: number | null;
  status: Status;
  reminderState: "not_sent" | "sent" | "renewed";
}

const STUDIO_NAME = "Trinetra Yoga";

const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const daysBetween = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const diff = target.getTime() - today().getTime();
  return Math.round(diff / 86400000);
};

const statusLabel: Record<Status, string> = {
  active: "Active",
  due_soon: "Due Soon",
  due_today: "Due Today",
  expired: "Expired",
  renewed: "Renewed",
};

const statusColor: Record<Status, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  due_soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  due_today: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  expired: "bg-destructive/15 text-destructive",
  renewed: "bg-primary/15 text-primary",
};

const filters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "due_soon", label: "Due Soon" },
  { key: "due_today", label: "Due Today" },
  { key: "expired", label: "Expired" },
  { key: "renewed", label: "Renewed" },
] as const;

const buildMessage = (name: string, renewalDate: string) =>
  `Hello ${name},\n\nYour membership at ${STUDIO_NAME} will expire on ${new Date(renewalDate).toLocaleDateString()}.\n\nPlease renew your membership before the expiry date to continue uninterrupted access to classes.\n\nThank you,\n${STUDIO_NAME}`;

const sanitizePhone = (phone: string | null) => (phone || "").replace(/[^0-9]/g, "");

const Renewals = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: cust }, { data: pays }] = await Promise.all([
      supabase.from("students").select("id,name,phone").eq("user_id", user.id).order("name"),
      supabase.from("student_payments").select("*").eq("user_id", user.id).order("paid_on", { ascending: false }),
    ]);
    setCustomers((cust as Customer[]) || []);
    setPayments(((pays as any[]) || []) as Payment[]);
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, [user]);

  const renewals: Renewal[] = useMemo(() => {
    const byCustomer = new Map<string, Payment[]>();
    payments.forEach((p) => {
      if (!byCustomer.has(p.student_id)) byCustomer.set(p.student_id, []);
      byCustomer.get(p.student_id)!.push(p);
    });
    return customers.map<Renewal>((c) => {
      const list = (byCustomer.get(c.id) || []).slice().sort((a, b) => (b.paid_on > a.paid_on ? 1 : -1));
      const latest = list[0] || null;
      const previous = list[1] || null;
      const renewalDate = latest?.valid_until || null;
      const daysRemaining = renewalDate ? daysBetween(renewalDate) : null;

      let status: Status = "active";
      let reminderState: "not_sent" | "sent" | "renewed" = "not_sent";

      if (!latest || !renewalDate) {
        status = "expired";
      } else if (daysRemaining === null) {
        status = "active";
      } else if (daysRemaining < 0) {
        status = "expired";
      } else if (daysRemaining === 0) {
        status = "due_today";
      } else if (daysRemaining <= 7) {
        status = "due_soon";
      } else {
        status = "active";
      }

      // If a newer payment exists after a prior renewal, mark as renewed if latest paid_on is recent (<= 7 days)
      if (latest && previous && previous.valid_until) {
        const renewedRecently = daysBetween(latest.paid_on) >= -30 && latest.paid_on >= previous.valid_until.slice(0, 10).slice(0, 10);
        // Show "Renewed" badge if latest payment was made within 30 days after previous expiry/renewal
        if (renewedRecently && status === "active") {
          reminderState = "renewed";
        }
      }
      if (latest?.reminder_sent_at && reminderState === "not_sent") reminderState = "sent";

      return { customer: c, latest, previous, renewalDate, daysRemaining, status, reminderState };
    });
  }, [customers, payments]);

  const counts = useMemo(() => {
    const c = { due_7: 0, due_3: 0, due_today: 0, expired: 0 };
    renewals.forEach((r) => {
      if (r.daysRemaining === null) return;
      if (r.daysRemaining < 0) c.expired++;
      else if (r.daysRemaining === 0) c.due_today++;
      if (r.daysRemaining >= 0 && r.daysRemaining <= 3) c.due_3++;
      if (r.daysRemaining >= 0 && r.daysRemaining <= 7) c.due_7++;
    });
    return c;
  }, [renewals]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return renewals.filter((r) => {
      if (filter !== "all") {
        if (filter === "renewed") {
          if (r.reminderState !== "renewed") return false;
        } else if (r.status !== filter) return false;
      }
      if (term && !(r.customer.name.toLowerCase().includes(term) || (r.customer.phone || "").includes(term))) return false;
      return true;
    });
  }, [renewals, filter, search]);

  const sendReminder = async (r: Renewal) => {
    if (!r.customer.phone) { toast.error("Customer has no phone number"); return; }
    if (!r.renewalDate) { toast.error("No renewal date set"); return; }
    const phone = sanitizePhone(r.customer.phone);
    if (!phone) { toast.error("Invalid phone"); return; }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(r.customer.name, r.renewalDate))}`;
    window.open(url, "_blank", "noopener");
    if (r.latest) {
      await supabase.from("student_payments").update({ reminder_sent_at: new Date().toISOString() } as any).eq("id", r.latest.id);
      fetchAll();
    }
  };

  const sendBulk = async () => {
    const targets = renewals.filter((r) => r.daysRemaining !== null && r.daysRemaining >= 0 && r.daysRemaining <= 7 && r.customer.phone);
    if (targets.length === 0) { toast.error("No customers due in the next 7 days"); return; }
    let opened = 0;
    for (const r of targets) {
      const phone = sanitizePhone(r.customer.phone);
      if (!phone || !r.renewalDate) continue;
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(r.customer.name, r.renewalDate))}`;
      window.open(url, "_blank", "noopener");
      opened++;
    }
    const ids = targets.map((r) => r.latest?.id).filter(Boolean) as string[];
    if (ids.length) {
      await supabase.from("student_payments").update({ reminder_sent_at: new Date().toISOString() } as any).in("id", ids);
    }
    toast.success(`Opened ${opened} WhatsApp reminder${opened === 1 ? "" : "s"}`);
    fetchAll();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Renewals</h1>
          <p className="text-muted-foreground mt-1">Membership expiry tracking & reminders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAll}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button onClick={sendBulk}><Send className="h-4 w-4 mr-2" />Send Bulk Reminders</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Due in 7 Days" value={counts.due_7} tone="amber" />
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Due in 3 Days" value={counts.due_3} tone="orange" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Due Today" value={counts.due_today} tone="orange" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Expired" value={counts.expired} tone="destructive" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No customers in this view.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <Card key={r.customer.id}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{r.customer.name}</h3>
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${statusColor[r.status]}`}>
                      {statusLabel[r.status]}
                    </span>
                    {r.reminderState === "sent" && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                        Reminder sent
                      </span>
                    )}
                    {r.reminderState === "renewed" && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-primary/15 text-primary flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Renewed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.customer.phone || "No phone"}
                    {r.latest?.duration_months ? ` · ${r.latest.duration_months} mo plan` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.renewalDate
                      ? <>Renews {new Date(r.renewalDate).toLocaleDateString()} · {r.daysRemaining !== null && r.daysRemaining >= 0 ? `${r.daysRemaining} day${r.daysRemaining === 1 ? "" : "s"} left` : `Expired ${Math.abs(r.daysRemaining || 0)} day${Math.abs(r.daysRemaining || 0) === 1 ? "" : "s"} ago`}</>
                      : "No active membership"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sendReminder(r)}
                  disabled={!r.customer.phone || !r.renewalDate}
                  className="shrink-0"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp Reminder
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "amber" | "orange" | "destructive" }) => {
  const toneClass =
    tone === "amber" ? "border-amber-500/30 from-amber-500/10" :
    tone === "orange" ? "border-orange-500/30 from-orange-500/10" :
    "border-destructive/30 from-destructive/10";
  return (
    <Card className={`bg-gradient-to-br ${toneClass} to-transparent border`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">{icon}{label}</div>
        <p className="font-display text-3xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
};

export default Renewals;
