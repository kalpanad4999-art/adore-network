import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fmtDate } from "@/lib/date";
import { waLink } from "@/lib/offers";
import { recordingRecipients, recordingShareUrl, registeredWhatsAppNumber, type SharingMember, type SharingRecording, type SharingAttendance } from "@/lib/attendanceSharing";

type Props = { ownerId: string; batchId: string; batchName: string; date: string; members: SharingMember[]; absentCount: number; studioName: string };

export default function AttendanceRecordingShare({ ownerId, batchId, batchName, date, members, absentCount, studioName }: Props) {
  const [audience, setAudience] = useState<"absent" | "everyone" | null>(null);
  const [recordings, setRecordings] = useState<SharingRecording[]>([]);
  const [attendance, setAttendance] = useState<SharingAttendance[]>([]);
  const [recordingId, setRecordingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState<string[]>([]);

  useEffect(() => {
    if (!audience) return;
    let cancelled = false;
    setLoading(true); setError(""); setRecordingId(""); setOpened([]); setRecordings([]); setAttendance([]);
    const load = async () => {
      try {
        const [r, a] = await Promise.all([
          supabase.from("recordings").select("id,title,public_slug,is_public,archived_at,publish_at,expires_at,storage_path,external_url").eq("user_id", ownerId).order("created_at", { ascending: false }),
          supabase.from("attendance").select("student_id,batch_id,attendance_date,status").eq("user_id", ownerId).eq("batch_id", batchId).eq("attendance_date", date),
        ]);
        if (r.error) throw r.error;
        if (a.error) throw a.error;
        if (!cancelled) { setRecordings(r.data ?? []); setAttendance(a.data ?? []); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load classes and attendance. Please retry.");
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [audience, ownerId, batchId, date]);

  const available = recordings.filter((r) => recordingShareUrl(r, window.location.origin));
  const recording = available.find((r) => r.id === recordingId);
  const link = recording ? recordingShareUrl(recording, window.location.origin) : null;
  const recipients = useMemo(() => recordingRecipients(members, attendance, batchId, date, audience ?? "absent"), [members, attendance, batchId, date, audience]);
  const hasSavedAttendance = attendance.length > 0;

  const openWhatsApp = (member: SharingMember) => {
    const phone = registeredWhatsAppNumber(member.phone);
    const currentLink = recording ? recordingShareUrl(recording, window.location.origin) : null;
    if (!phone || !recording || !currentLink || !hasSavedAttendance) return;
    const message = `Hi ${member.name}, here is the recorded class from ${studioName}.\nBatch: ${batchName}\nAttendance date: ${fmtDate(date)}\nClass: ${recording.title}\n${currentLink}`;
    const popup = window.open(waLink(phone, message), "_blank");
    if (!popup) { toast.error("WhatsApp could not open. Allow pop-ups and try again."); return; }
    popup.opener = null;
    setOpened((ids) => ids.includes(member.id) ? ids : [...ids, member.id]);
    toast.success(`WhatsApp opened for ${member.name}. Message is ready to send.`);
  };

  return <>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="h-auto min-h-10 whitespace-normal text-left" disabled={!absentCount} onClick={() => setAudience("absent")}><MessageCircle className="mr-2 h-4 w-4 shrink-0" />Send Recorded Class to Absent Members ({absentCount})</Button>
      <Button variant="outline" className="h-auto min-h-10 whitespace-normal text-left" onClick={() => setAudience("everyone")}><MessageCircle className="mr-2 h-4 w-4 shrink-0" />Send Recorded Class to Everyone</Button>
    </div>
    <Dialog open={!!audience} onOpenChange={(open) => { if (!open) setAudience(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Send Recorded Class · {audience === "absent" ? "Absent Members" : "Everyone"}</DialogTitle><DialogDescription>{batchName} · {fmtDate(date)}</DialogDescription></DialogHeader>
        {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading classes…</div> : error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !hasSavedAttendance ? <p className="text-sm text-muted-foreground">No saved attendance for this batch and date.</p> : <div className="space-y-4 min-w-0">
          {available.length ? <div className="space-y-2"><Label>Recorded class</Label><Select value={recordingId} onValueChange={(id) => { setRecordingId(id); setOpened([]); }}><SelectTrigger aria-label="Recorded class" className="w-full min-w-0 [&>span]:truncate"><SelectValue placeholder="Select a recording" /></SelectTrigger><SelectContent>{available.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select></div> : <p className="text-sm text-muted-foreground">No published, public recordings are available from Classes.</p>}
          {recording && link && <div className="space-y-1 border-y border-border py-3"><p className="font-medium break-words">{recording.title}</p><a href={link} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-primary underline">{link}</a></div>}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{recipients.length} members · {opened.length} WhatsApp chats opened</p>
            {!recipients.length && <p className="text-sm text-muted-foreground">No absent members for this batch and date.</p>}
            {recipients.map((m) => <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2"><div className="min-w-0"><p className="font-medium break-words">{m.name}</p><p className="text-xs text-muted-foreground">{registeredWhatsAppNumber(m.phone) ? m.phone : "No valid registered mobile number"}</p>{opened.includes(m.id) && <p className="text-xs text-primary" role="status">WhatsApp opened · ready to send</p>}</div><Button size="sm" variant="outline" disabled={!link || !registeredWhatsAppNumber(m.phone)} onClick={() => openWhatsApp(m)}><MessageCircle className="mr-2 h-4 w-4" />{opened.includes(m.id) ? "Open again" : "Open WhatsApp"}</Button></div>)}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}