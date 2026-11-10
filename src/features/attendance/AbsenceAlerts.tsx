import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, MessageCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/date";
import { registeredWhatsAppNumber } from "@/lib/attendanceSharing";
import { waLink } from "@/lib/offers";
import { absenceMessage, alertKey, buildAbsenceAlerts, indiaToday, type AbsenceAlert } from "./absenceRules";
import { loadAbsenceData, saveBatchSchedule, confirmAbsenceSent } from "./absenceService";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type Props = { ownerId: string; batches: { id: string; name: string }[]; batchFilter: string; attendanceVersion: unknown };
export default function AbsenceAlerts({ ownerId, batches, batchFilter, attendanceVersion }: Props) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAbsenceData>> | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [settings, setSettings] = useState(false), [batchId, setBatchId] = useState("");
  const [days, setDays] = useState<number[]>([]), [effective, setEffective] = useState(indiaToday());
  const [selected, setSelected] = useState<AbsenceAlert | null>(null), [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false), generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError("");
    try { const next = await loadAbsenceData(ownerId); if (request === generation.current) setData(next); }
    catch (e) { if (request === generation.current) { setData(null); setError(e instanceof Error ? e.message : "Could not load absence alerts. Please retry."); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [ownerId]);
  useEffect(() => { void refresh(); }, [refresh, attendanceVersion]);
  useEffect(() => {
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    const interval = window.setInterval(focus, 60000);
    const channel = supabase.channel(`absence-alerts-${ownerId}`).on("postgres_changes", { event: "*", schema: "public", table: "attendance_absence_followups", filter: `owner_id=eq.${ownerId}` }, focus).on("postgres_changes", { event: "*", schema: "public", table: "attendance_batch_schedules", filter: `owner_id=eq.${ownerId}` }, focus).subscribe();
    return () => { generation.current++; window.removeEventListener("focus", focus); window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [ownerId, refresh]);
  const alerts = useMemo(() => data ? buildAbsenceAlerts(data.members, data.schedules, data.records, data.sent, indiaToday()).filter((a) => batchFilter === "all" || a.batchId === batchFilter) : [], [data, batchFilter]);
  const chooseBatch = (id: string) => {
    setBatchId(id);
    const schedule = data?.schedules.find((s) => s.batch_id === id);
    setDays(schedule?.weekdays ?? []); setEffective(schedule?.effective_from ?? indiaToday());
  };
  const runSave = async (operation: () => Promise<void>, success: () => void) => {
    if (lock.current) return;
    lock.current = true; setSaving(true);
    try { await operation(); success(); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save. Please retry."); }
    finally { lock.current = false; setSaving(false); }
  };
  const openWhatsApp = () => {
    if (!selected) return;
    const number = registeredWhatsAppNumber(selected.member.phone);
    if (!number) { toast.error("This member has no valid registered mobile number."); return; }
    if (!navigator.onLine) { toast.error("WhatsApp is unavailable while offline. Check your connection and retry."); return; }
    const popup = window.open(waLink(number, absenceMessage(selected.member.name)), "_blank");
    if (!popup) { toast.error("WhatsApp could not open. Allow pop-ups and try again."); return; }
    popup.opener = null; setOpened(true);
    toast.info("WhatsApp opened. Sending is not yet confirmed.");
  };
  return <section className="space-y-3 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-display text-xl font-semibold">3-Day Absence Alerts</h2><p className="text-sm text-muted-foreground">{loading || error ? "—" : alerts.length} members requiring follow-up</p></div>
      <div className="flex gap-2"><Button variant="ghost" size="icon" aria-label="Refresh absence alerts" title="Refresh absence alerts" disabled={loading} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button><Button variant="outline" onClick={() => { chooseBatch(batchFilter !== "all" ? batchFilter : batches[0]?.id ?? ""); setSettings(true); }} disabled={loading || !!error}><CalendarDays className="mr-2 h-4 w-4" />Class days</Button></div>
    </div>
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading alerts…</p> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <>
      {!!batches.filter((b) => !data?.schedules.some((s) => s.batch_id === b.id && s.weekdays.length)).length && <p className="text-sm text-muted-foreground">Class days not set: {batches.filter((b) => !data?.schedules.some((s) => s.batch_id === b.id && s.weekdays.length)).map((b) => b.name).join(", ")}</p>}
      {!alerts.length && <p className="text-sm text-muted-foreground">No qualifying absence streaks.</p>}
      {alerts.map((a) => <div key={alertKey(a)} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="min-w-0"><p className="font-medium break-words">{a.member.name}</p><p className="text-sm text-muted-foreground break-words">{a.member.phone || "No registered mobile number"} · {batches.find((b) => b.id === a.batchId)?.name}</p><p className="text-xs text-muted-foreground">Last attendance: {a.lastAttendance ? fmtDate(a.lastAttendance) : "Never recorded"} · {a.missedDays} missed class days</p></div>
        <Button size="sm" variant="outline" onClick={() => { setSelected(a); setOpened(false); }}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button>
      </div>)}
    </>}
    <Dialog open={settings} onOpenChange={(open) => { if (!saving) setSettings(open); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Batch class days</DialogTitle><DialogDescription>Weekly schedule · India time</DialogDescription></DialogHeader>
      <Label>Batch</Label><Select value={batchId} onValueChange={chooseBatch} disabled={saving}><SelectTrigger aria-label="Schedule batch"><SelectValue placeholder="Select batch" /></SelectTrigger><SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
      <div className="grid grid-cols-2 gap-3">{weekdays.map((day, index) => <label key={day} className="flex items-center gap-2 text-sm"><Checkbox disabled={saving} checked={days.includes(index)} onCheckedChange={(checked) => setDays((prev) => checked ? [...prev, index] : prev.filter((d) => d !== index))} />{day}</label>)}</div>
      <Label htmlFor="absence-effective">Schedule effective from</Label><Input id="absence-effective" type="date" value={effective} max={indiaToday()} disabled={saving} onChange={(e) => setEffective(e.target.value)} />
      <Button disabled={saving || !batchId || !effective || effective > indiaToday()} onClick={() => void runSave(() => saveBatchSchedule(ownerId, { batch_id: batchId, weekdays: days, effective_from: effective }), () => { setSettings(false); toast.success("Class days saved"); })}>{saving ? "Saving…" : "Save class days"}</Button>
    </DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open && !saving) setSelected(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Absence follow-up</DialogTitle><DialogDescription>{selected?.member.name} · {selected?.member.phone || "No registered mobile number"}</DialogDescription></DialogHeader>
      <p className="text-sm break-words border-y border-border py-3">{selected ? absenceMessage(selected.member.name) : ""}</p>
      {opened && <p role="status" className="text-sm text-muted-foreground">WhatsApp opened · sending not confirmed</p>}
      <Button variant="outline" onClick={openWhatsApp} disabled={saving}><MessageCircle className="mr-2 h-4 w-4" />{opened ? "Open WhatsApp again" : "Open WhatsApp"}</Button>
      <Button disabled={!opened || saving} onClick={() => { if (selected) void runSave(() => confirmAbsenceSent(ownerId, selected), () => { setSelected(null); toast.success("Marked as sent by you"); }); }}>{saving ? "Saving…" : "I sent this message · Mark as sent"}</Button>
    </DialogContent></Dialog>
  </section>;
}