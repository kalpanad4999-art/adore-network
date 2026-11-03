import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRenewalContext } from "@/features/renewals/useRenewalData";
import { Bucket, Renewal } from "@/features/renewals/renewalRules";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, RefreshCw, CalendarClock, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";
import { fmtDate } from "@/lib/date";

const bucketLabel: Record<Bucket, string> = {
  active: "Active",
  due_7: "Due in 7 Days",
  due_3: "Due in 3 Days",
  due_today: "Due Today",
  expired: "Expired",
};

const bucketColor: Record<Bucket, string> = {
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  due_7: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  due_3: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  due_today: "bg-orange-600/15 text-orange-700 dark:text-orange-400",
  expired: "bg-destructive/15 text-destructive",
};

type FilterKey = "all" | Bucket | "renewed";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "due_7", label: "Due in 7 Days" },
  { key: "due_3", label: "Due in 3 Days" },
  { key: "due_today", label: "Due Today" },
  { key: "expired", label: "Expired" },
  { key: "renewed", label: "Renewed" },
];

const buildMessage = (name: string, renewalDate: string) =>
  `Hello ${name},\n\nJust a quick reminder that your Trinetra Yoga membership expires on ${fmtDate(renewalDate)}.\n\nTo continue enjoying uninterrupted access to classes, please renew before the expiry date.\n\nIF YOU HAVE ALREADY PAID, PLEASE IGNORE THIS MESSAGE.\n\nThank you,\n\nTeam Trinetra Yoga`;

const sanitizePhone = (phone: string | null) => (phone || "").replace(/[^0-9]/g, "");

const Renewals = () => {
  const { renewals, batches, loading, error, fetchAll } = useRenewalContext();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [params] = useSearchParams();
  const selectedMember = params.get("member");
  const selectedCard = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedMember) { setFilter("all"); setSearch(""); }
  }, [selectedMember]);
  useEffect(() => {
    if (!loading && selectedMember) {
      selectedCard.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      selectedCard.current?.focus({ preventScroll: true });
    }
  }, [loading, selectedMember]);
  const batchMap = useMemo(() => new Map(batches.map(b => [b.id, b.name])), [batches]);

  const counts = useMemo(() => {
    const c = { due_7: 0, due_3: 0, due_today: 0, expired: 0 };
    renewals.forEach((r) => {
      if (r.bucket === "due_7") c.due_7++;
      else if (r.bucket === "due_3") c.due_3++;
      else if (r.bucket === "due_today") c.due_today++;
      else if (r.bucket === "expired") c.expired++;
    });
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[Renewals] counts:", c);
    }
    return c;
  }, [renewals]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return renewals.filter((r) => {
      if (filter === "renewed") {
        if (r.reminderState !== "renewed") return false;
      } else if (filter !== "all") {
        if (r.bucket !== filter) return false;
      }
      if (term && !(r.customer.name.toLowerCase().includes(term) || (r.customer.phone || "").includes(term))) return false;
      return true;
    });
  }, [renewals, filter, search]);

  const buildWaUrl = (r: Renewal): string | null => {
    const phone = sanitizePhone(r.customer.phone);
    if (!phone || !r.renewalDate) return null;
    return `https://wa.me/${phone}?text=${encodeURIComponent(buildMessage(r.customer.name, r.renewalDate))}`;
  };

  const markReminderSent = async (r: Renewal) => {
    if (!r.latest) return;
    await supabase
      .from("student_payments")
      .update({ reminder_sent_at: new Date().toISOString() } as any)
      .eq("id", r.latest.id);
    fetchAll();
  };

  const sendBulk = async () => {
    const targets = renewals.filter((r) => r.daysRemaining !== null && r.daysRemaining >= 0 && r.daysRemaining <= 7 && r.customer.phone);
    if (targets.length === 0) { toast.error("No customers due in the next 7 days"); return; }
    let opened = 0;
    for (const r of targets) {
      const url = buildWaUrl(r);
      if (!url) continue;
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (win) opened++;
    }
    if (opened === 0) {
      toast.error("Popup blocked. Please allow popups for this site, then retry.");
      return;
    }
    const ids = targets.slice(0, opened).map((r) => r.latest?.id).filter(Boolean) as string[];
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
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Due in 7 Days" value={counts.due_7} tone="amber" active={filter === "due_7"} onClick={() => setFilter(filter === "due_7" ? "all" : "due_7")} />
        <StatCard icon={<CalendarClock className="h-5 w-5" />} label="Due in 3 Days" value={counts.due_3} tone="orange" active={filter === "due_3"} onClick={() => setFilter(filter === "due_3" ? "all" : "due_3")} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Due Today" value={counts.due_today} tone="orange" active={filter === "due_today"} onClick={() => setFilter(filter === "due_today" ? "all" : "due_today")} />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Expired" value={counts.expired} tone="destructive" active={filter === "expired"} onClick={() => setFilter(filter === "expired" ? "all" : "expired")} />
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

      {error ? (
        <p role="alert" className="text-destructive">Renewals could not be loaded. Please refresh to retry.</p>
      ) : loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No customers in this view.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <Card key={r.customer.id} ref={selectedMember === r.customer.id ? selectedCard : undefined} tabIndex={selectedMember === r.customer.id ? -1 : undefined} className={selectedMember === r.customer.id ? "ring-2 ring-primary" : undefined}>
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{r.customer.name}</h3>
                    {r.bucket && (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${bucketColor[r.bucket]}`}>
                        {bucketLabel[r.bucket]}
                      </span>
                    )}
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
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] font-medium gap-1">
                      <Users className="h-3 w-3" />
                      {r.customer.batch_id ? (batchMap.get(r.customer.batch_id) || "No Batch Assigned") : "No Batch Assigned"}
                    </Badge>
                    <span>{r.customer.phone || "No phone"}</span>
                    {r.latest?.duration_months ? <span>· {r.latest.duration_months} mo plan</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.renewalDate
                      ? <>Renews {fmtDate(r.renewalDate)} · {r.daysRemaining !== null && r.daysRemaining >= 0 ? `${r.daysRemaining} day${r.daysRemaining === 1 ? "" : "s"} left` : `Expired ${Math.abs(r.daysRemaining || 0)} day${Math.abs(r.daysRemaining || 0) === 1 ? "" : "s"} ago`}</>
                      : "No active membership"}
                  </p>
                </div>

                {(() => {
                  const waUrl = buildWaUrl(r);
                  const disabled = !waUrl;
                  return (
                    <Button
                      asChild={!disabled}
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      className="shrink-0"
                    >
                      {disabled ? (
                        <span>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp Reminder
                        </span>
                      ) : (
                        <a
                          href={waUrl ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => markReminderSent(r)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp Reminder
                        </a>
                      )}
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, tone, active, onClick }: { icon: React.ReactNode; label: string; value: number; tone: "amber" | "orange" | "destructive"; active?: boolean; onClick?: () => void }) => {
  const toneClass =
    tone === "amber" ? "border-amber-500/30 from-amber-500/10" :
    tone === "orange" ? "border-orange-500/30 from-orange-500/10" :
    "border-destructive/30 from-destructive/10";
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={`bg-gradient-to-br ${toneClass} to-transparent border transition-all hover:shadow-md ${active ? "ring-2 ring-primary" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">{icon}{label}</div>
          <p className="font-display text-3xl font-bold mt-1">{value}</p>
        </CardContent>
      </Card>
    </button>
  );
};

export default Renewals;
