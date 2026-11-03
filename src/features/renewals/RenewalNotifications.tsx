import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MessageCircle, X, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate } from "@/lib/date";
import { Renewal, renewalNotificationId, unseenRenewals } from "./renewalRules";
import { useRenewalContext } from "./useRenewalData";

function readDismissed(key: string): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
  } catch { return new Set(); }
}

function NotificationCard({ renewal, onDismiss, onOpen }: { renewal: Renewal; onDismiss: () => void; onOpen: () => void }) {
  return <section className="rounded-lg border border-primary/25 bg-popover p-4 shadow-md" aria-label={`Renewal notification for ${renewal.customer.name}`}>
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><MessageCircle className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-primary">{renewal.bucket === "expired" ? "Renewal overdue" : "Renewal due today"}</p>
        <p className="mt-1 break-words font-semibold">{renewal.customer.name}</p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{renewal.customer.phone || "No mobile number registered"}</p>
        <p className="mt-1 text-sm">Renews {renewal.renewalDate ? fmtDate(renewal.renewalDate) : "—"}</p>
        {typeof renewal.latest?.due_amount === "number" && <p className="mt-1 text-sm">Pending ₹{renewal.latest.due_amount.toLocaleString("en-IN")}</p>}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Dismiss renewal for ${renewal.customer.name}`} title="Dismiss notification" onClick={onDismiss}><X /></Button>
    </div>
    <div className="mt-3 flex justify-end"><Button size="sm" onClick={onOpen}>Renewal details <ArrowRight /></Button></div>
  </section>;
}

export default function RenewalNotifications() {
  const { pending, allowed, workspaceId, userId, error, loading, fetchAll } = useRenewalContext();
  const storageKey = `renewal-notifications:v1:${workspaceId}:${userId}`;
  const [dismissal, setDismissal] = useState(() => ({ key: storageKey, ids: readDismissed(storageKey) }));
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setDismissal({ key: storageKey, ids: readDismissed(storageKey) }); }, [storageKey]);
  const dismissed = useMemo(() => dismissal.key === storageKey ? dismissal.ids : readDismissed(storageKey), [dismissal, storageKey]);
  const unseen = unseenRenewals(pending, dismissed);
  const dismiss = (r: Renewal) => {
    const ids = new Set(dismissed).add(renewalNotificationId(r));
    setDismissal({ key: storageKey, ids });
    try { localStorage.setItem(storageKey, JSON.stringify([...ids])); } catch { /* In-memory dismissal still works if storage is blocked. */ }
  };
  const details = (r: Renewal) => {
    dismiss(r);
    setOpen(false);
    navigate(`/renewals?member=${encodeURIComponent(r.customer.id)}`);
  };
  if (!allowed) return null;
  const active = unseen[0];
  return <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative shrink-0" aria-label={`Renewal notifications, ${pending.length} pending`} title="Renewal notifications">
        <Bell />{pending.length > 0 && <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">{pending.length}</Badge>}
      </Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-3">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="font-semibold">Pending renewals ({pending.length})</p><Button variant="ghost" size="icon" aria-label="Refresh renewals" disabled={loading} onClick={() => { void fetchAll(); }}><RefreshCw /></Button></div>
        {error ? <p role="alert" className="text-sm text-destructive">Renewals could not be refreshed. Please retry.</p> : pending.length === 0 ? <p className="text-sm text-muted-foreground">No renewals due.</p> : <div className="max-h-[60dvh] space-y-3 overflow-y-auto">{pending.map(r => <NotificationCard key={renewalNotificationId(r)} renewal={r} onDismiss={() => dismiss(r)} onOpen={() => details(r)} />)}</div>}
      </PopoverContent>
    </Popover>
    {active && !open && !error && <div className="fixed right-4 top-20 z-40 w-[min(24rem,calc(100vw-2rem))] motion-safe:animate-fade-in" role="status" aria-live="polite">
      <NotificationCard renewal={active} onDismiss={() => dismiss(active)} onOpen={() => details(active)} />
      {unseen.length > 1 && <p className="mt-1 rounded-md bg-popover px-3 py-1 text-right text-xs text-muted-foreground">{unseen.length - 1} more pending notifications</p>}
    </div>}
  </>;
}