import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Radio, Plus, Trash2, ExternalLink, Upload, Eye, EyeOff, Copy, Link as LinkIcon, QrCode } from "lucide-react";
import ShareLinkDialog from "@/components/ShareLinkDialog";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

type Recording = {
  id: string; title: string; description: string | null;
  storage_path: string | null; external_url: string | null;
  duration_minutes: number | null; recorded_on: string | null;
  is_public: boolean; created_at: string;
  public_slug: string | null; publish_at: string | null;
  expires_at: string | null; archived_at: string | null;
  source_live_class_id: string | null;
};
type Live = {
  id: string; title: string; description: string | null;
  scheduled_at: string; duration_minutes: number; meeting_url: string;
  platform: string | null; is_public: boolean;
  auto_convert_to_recording: boolean;
  recording_visibility: string;
  recording_publish_delay_minutes: number | null;
  recording_hide_after_days: number | null;
  converted_recording_id: string | null;
  converted_at: string | null;
};

const useSignedUrl = (bucket: string, path: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) { setUrl(null); return; }
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [bucket, path]);
  return url;
};

const recordingStatus = (r: Recording): { label: string; tone: string } => {
  if (r.archived_at) return { label: "Archived", tone: "bg-muted text-muted-foreground" };
  const now = Date.now();
  if (r.publish_at && new Date(r.publish_at).getTime() > now) return { label: "Pending", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  return { label: "Recorded", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
};

const liveStatus = (l: Live): { label: string; tone: string } => {
  if (l.converted_recording_id) return { label: "Recorded", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
  const start = new Date(l.scheduled_at).getTime();
  const end = start + l.duration_minutes * 60 * 1000;
  const now = Date.now();
  if (now < start) return { label: "Scheduled", tone: "bg-primary/10 text-primary" };
  if (now >= start && now <= end) return { label: "Live", tone: "bg-red-500/15 text-red-600 dark:text-red-400" };
  if (l.auto_convert_to_recording) return { label: "Pending", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  return { label: "Past", tone: "bg-muted text-muted-foreground" };
};

const PublicLinkDialog = ({ open, onOpenChange, slug, title }: { open: boolean; onOpenChange: (v: boolean) => void; slug: string | null; title: string; }) => {
  const url = slug ? `${window.location.origin}/r/${slug}` : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Public link</DialogTitle>
          <DialogDescription>Permanent link and QR for "{title}". Always resolves to the latest recording.</DialogDescription>
        </DialogHeader>
        {slug ? (
          <div className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG value={url} size={192} />
            </div>
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Link is being generated. Refresh the page.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

const RecordingCard = ({ r, canManage, onDelete, onTogglePublic, onShare }: {
  r: Recording; canManage: boolean;
  onDelete: () => void; onTogglePublic: (v: boolean) => void; onShare: () => void;
}) => {
  const url = useSignedUrl("studio-recordings", r.storage_path);
  const status = recordingStatus(r);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium truncate">{r.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${status.tone}`}>{status.label}</span>
            </div>
            {r.description && <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {r.recorded_on ? format(new Date(r.recorded_on), "PP") : "—"}
              {r.duration_minutes ? ` · ${r.duration_minutes} min` : ""}
              {r.publish_at && new Date(r.publish_at).getTime() > Date.now() && ` · publishes ${formatDistanceToNow(new Date(r.publish_at), { addSuffix: true })}`}
              {r.expires_at && ` · hides ${formatDistanceToNow(new Date(r.expires_at), { addSuffix: true })}`}
            </p>
          </div>
          {canManage && (
            <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
        {r.storage_path && url && <video src={url} controls className="w-full rounded-md bg-black" />}
        {r.external_url && (
          <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" />Open recording
          </a>
        )}
        <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {r.is_public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {r.is_public ? "Public" : "Private"}
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <Button size="sm" variant="ghost" onClick={onShare}>
                <QrCode className="h-4 w-4 mr-1" />Link & QR
              </Button>
            )}
            {canManage && <Switch checked={r.is_public} onCheckedChange={onTogglePublic} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const DEFAULT_LIVE_FORM = {
  title: "", description: "", scheduled_at: "", duration_minutes: "60",
  meeting_url: "", platform: "", is_public: false,
  auto_convert: false,
  recording_visibility: "immediate" as "immediate" | "delayed" | "permanent_hidden",
  delay_value: "1", delay_unit: "hours" as "hours" | "days" | "months" | "years",
  hide_never: true, hide_value: "30", hide_unit: "days" as "days" | "months" | "years",
};

const delayToMinutes = (v: string, unit: string) => {
  const n = Math.max(0, Number(v) || 0);
  const mult = unit === "hours" ? 60 : unit === "days" ? 1440 : unit === "months" ? 43200 : unit === "years" ? 525600 : 60;
  return n * mult;
};
const hideToDays = (v: string, unit: string) => {
  const n = Math.max(0, Number(v) || 0);
  const mult = unit === "days" ? 1 : unit === "months" ? 30 : unit === "years" ? 365 : 1;
  return n * mult;
};

const Media = () => {
  const { user } = useAuth();
  const { ownerId, isOwner, permissions } = useStudio();
  const workspaceId = ownerId || user?.id || null;
  const canManage = isOwner || !!permissions?.classes;

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [live, setLive] = useState<Live[]>([]);

  const recordingInputRef = useRef<HTMLInputElement>(null);

  const [recOpen, setRecOpen] = useState(false);
  const [recForm, setRecForm] = useState({ title: "", description: "", external_url: "", duration_minutes: "", recorded_on: "", is_public: false });

  const [liveOpen, setLiveOpen] = useState(false);
  const [editingLiveId, setEditingLiveId] = useState<string | null>(null);
  const [liveForm, setLiveForm] = useState(DEFAULT_LIVE_FORM);

  const [shareRec, setShareRec] = useState<Recording | null>(null);
  const [shareRecordingsOpen, setShareRecordingsOpen] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    // Trigger lifecycle processing to keep views fresh (harmless if nothing to do)
    supabase.functions.invoke("process-live-classes").catch(() => {});
    const [r, l] = await Promise.all([
      supabase.from("recordings").select("*").order("created_at", { ascending: false }),
      supabase.from("live_classes").select("*").order("scheduled_at", { ascending: true }),
    ]);
    setRecordings(((r.data as any) || []) as Recording[]);
    setLive(((l.data as any) || []) as Live[]);
  };

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, 60_000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [user]);

  // Recordings
  const uploadRecordingFile = async (files: FileList | null) => {
    if (!files || !workspaceId || !user) return;
    const file = files[0];
    if (!file.type.startsWith("video/")) { toast.error("Video files only"); return; }
    if (file.size > 500 * 1024 * 1024) { toast.error("Max 500MB"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `${workspaceId}/${Date.now()}.${ext}`;
    toast.loading("Uploading...", { id: "rec-up" });
    const { error: upErr } = await supabase.storage.from("studio-recordings").upload(path, file, { contentType: file.type });
    if (upErr) { toast.error(upErr.message, { id: "rec-up" }); return; }
    const { error } = await supabase.from("recordings").insert({ user_id: user.id, title: file.name, storage_path: path });
    toast.dismiss("rec-up");
    if (error) toast.error(error.message); else toast.success("Recording added");
    fetchAll();
  };

  const submitRecordingLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const title = recForm.title.trim();
    if (!title) { toast.error("Title required"); return; }
    if (!recForm.external_url.trim()) { toast.error("URL required"); return; }
    const { error } = await supabase.from("recordings").insert({
      user_id: user.id, title, description: recForm.description.trim() || null,
      external_url: recForm.external_url.trim(),
      duration_minutes: recForm.duration_minutes ? Number(recForm.duration_minutes) : null,
      recorded_on: recForm.recorded_on || null,
      is_public: recForm.is_public,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Recording added");
    setRecOpen(false);
    setRecForm({ title: "", description: "", external_url: "", duration_minutes: "", recorded_on: "", is_public: false });
    fetchAll();
  };

  const deleteRecording = async (r: Recording) => {
    if (!confirm("Delete this recording?")) return;
    if (r.storage_path) await supabase.storage.from("studio-recordings").remove([r.storage_path]);
    await supabase.from("recordings").delete().eq("id", r.id);
    fetchAll();
  };

  // Live classes
  const submitLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const title = liveForm.title.trim();
    if (!title) { toast.error("Title required"); return; }
    if (!liveForm.scheduled_at) { toast.error("Date & time required"); return; }
    if (!/^https?:\/\//i.test(liveForm.meeting_url)) { toast.error("Valid meeting URL required"); return; }

    const publishDelayMinutes = liveForm.auto_convert && liveForm.recording_visibility === "delayed"
      ? delayToMinutes(liveForm.delay_value, liveForm.delay_unit)
      : null;
    const hideAfterDays = liveForm.auto_convert && !liveForm.hide_never
      ? hideToDays(liveForm.hide_value, liveForm.hide_unit)
      : null;

    const payload: any = {
      user_id: user.id, title, description: liveForm.description.trim() || null,
      scheduled_at: new Date(liveForm.scheduled_at).toISOString(),
      duration_minutes: Number(liveForm.duration_minutes) || 60,
      meeting_url: liveForm.meeting_url.trim(),
      platform: liveForm.platform.trim() || null,
      is_public: liveForm.is_public,
      auto_convert_to_recording: liveForm.auto_convert,
      recording_visibility: liveForm.auto_convert ? liveForm.recording_visibility : "immediate",
      recording_publish_delay_minutes: publishDelayMinutes,
      recording_hide_after_days: hideAfterDays,
    };
    const { error } = editingLiveId
      ? await supabase.from("live_classes").update(payload).eq("id", editingLiveId)
      : await supabase.from("live_classes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingLiveId ? "Updated" : "Scheduled");
    setLiveOpen(false); setEditingLiveId(null);
    setLiveForm(DEFAULT_LIVE_FORM);
    fetchAll();
  };

  const deleteLive = async (id: string) => {
    if (!confirm("Cancel this class?")) return;
    await supabase.from("live_classes").delete().eq("id", id);
    fetchAll();
  };

  const editLive = (l: Live) => {
    setEditingLiveId(l.id);
    const delayMinutes = l.recording_publish_delay_minutes ?? 0;
    let delay_unit: "hours" | "days" | "months" | "years" = "hours";
    let delay_value = "1";
    if (delayMinutes > 0) {
      if (delayMinutes % 525600 === 0) { delay_unit = "years"; delay_value = String(delayMinutes / 525600); }
      else if (delayMinutes % 43200 === 0) { delay_unit = "months"; delay_value = String(delayMinutes / 43200); }
      else if (delayMinutes % 1440 === 0) { delay_unit = "days"; delay_value = String(delayMinutes / 1440); }
      else { delay_unit = "hours"; delay_value = String(Math.round(delayMinutes / 60)); }
    }
    const hideDays = l.recording_hide_after_days;
    let hide_unit: "days" | "months" | "years" = "days";
    let hide_value = "30";
    let hide_never = hideDays == null;
    if (hideDays != null) {
      if (hideDays % 365 === 0) { hide_unit = "years"; hide_value = String(hideDays / 365); }
      else if (hideDays % 30 === 0) { hide_unit = "months"; hide_value = String(hideDays / 30); }
      else { hide_unit = "days"; hide_value = String(hideDays); }
    }
    setLiveForm({
      title: l.title, description: l.description || "",
      scheduled_at: format(new Date(l.scheduled_at), "yyyy-MM-dd'T'HH:mm"),
      duration_minutes: String(l.duration_minutes), meeting_url: l.meeting_url,
      platform: l.platform || "", is_public: l.is_public,
      auto_convert: l.auto_convert_to_recording,
      recording_visibility: (l.recording_visibility as any) || "immediate",
      delay_value, delay_unit, hide_never, hide_value, hide_unit,
    });
    setLiveOpen(true);
  };

  const publicRecordingsUrl = workspaceId ? `${window.location.origin}/recordings/${workspaceId}` : "";
  const copyRecordingsLink = () => {
    if (!publicRecordingsUrl) return;
    navigator.clipboard.writeText(publicRecordingsUrl);
    toast.success("Public recordings link copied");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground mt-1">Recordings and live online classes</p>
        </div>
      </div>

      <Tabs defaultValue="recordings" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="recordings"><Video className="h-4 w-4 mr-2" />Recordings</TabsTrigger>
          <TabsTrigger value="live"><Radio className="h-4 w-4 mr-2" />Live</TabsTrigger>
        </TabsList>

        <TabsContent value="recordings" className="space-y-4">
          {canManage && (
            <div className="flex justify-end gap-2 flex-wrap">
              <input ref={recordingInputRef} type="file" accept="video/*" hidden onChange={(e) => uploadRecordingFile(e.target.files)} />
              <Button variant="outline" onClick={() => recordingInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload video</Button>
              <Dialog open={recOpen} onOpenChange={setRecOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add link</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Add recording link</DialogTitle><DialogDescription>YouTube, Vimeo or Drive link.</DialogDescription></DialogHeader>
                  <form onSubmit={submitRecordingLink} className="space-y-3">
                    <div className="space-y-2"><Label>Title</Label><Input value={recForm.title} onChange={(e) => setRecForm({ ...recForm, title: e.target.value })} maxLength={120} required /></div>
                    <div className="space-y-2"><Label>URL</Label><Input type="url" value={recForm.external_url} onChange={(e) => setRecForm({ ...recForm, external_url: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={recForm.description} onChange={(e) => setRecForm({ ...recForm, description: e.target.value })} maxLength={500} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Recorded on</Label><Input type="date" value={recForm.recorded_on} onChange={(e) => setRecForm({ ...recForm, recorded_on: e.target.value })} /></div>
                      <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" min="1" value={recForm.duration_minutes} onChange={(e) => setRecForm({ ...recForm, duration_minutes: e.target.value })} /></div>
                    </div>
                    <label className="flex items-center justify-between text-sm"><span>Make public</span><Switch checked={recForm.is_public} onCheckedChange={(v) => setRecForm({ ...recForm, is_public: v })} /></label>
                    <Button type="submit" className="w-full">Add</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {recordings.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No recordings yet.</CardContent></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {recordings.map((r) => (
                <RecordingCard key={r.id} r={r} canManage={canManage}
                  onDelete={() => deleteRecording(r)}
                  onTogglePublic={async (v) => { await supabase.from("recordings").update({ is_public: v }).eq("id", r.id); fetchAll(); }}
                  onShare={() => setShareRec(r)}
                />
              ))}
            </div>
          )}
          <PublicLinkDialog open={!!shareRec} onOpenChange={(v) => !v && setShareRec(null)} slug={shareRec?.public_slug ?? null} title={shareRec?.title ?? ""} />
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Dialog open={liveOpen} onOpenChange={(v) => { if (!v) { setLiveOpen(false); setEditingLiveId(null); setLiveForm(DEFAULT_LIVE_FORM); } else setLiveOpen(true); }}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Schedule live class</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="font-display">{editingLiveId ? "Edit" : "Schedule"} live class</DialogTitle><DialogDescription>Add a Zoom / Meet / YouTube link.</DialogDescription></DialogHeader>
                  <form onSubmit={submitLive} className="space-y-3">
                    <div className="space-y-2"><Label>Title</Label><Input value={liveForm.title} onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })} maxLength={120} required /></div>
                    <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={liveForm.description} onChange={(e) => setLiveForm({ ...liveForm, description: e.target.value })} maxLength={500} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2"><Label>Date & time</Label><Input type="datetime-local" value={liveForm.scheduled_at} onChange={(e) => setLiveForm({ ...liveForm, scheduled_at: e.target.value })} required /></div>
                      <div className="space-y-2"><Label>Duration (min)</Label><Input type="number" min="5" value={liveForm.duration_minutes} onChange={(e) => setLiveForm({ ...liveForm, duration_minutes: e.target.value })} required /></div>
                    </div>
                    <div className="space-y-2"><Label>Meeting URL</Label><Input type="url" placeholder="https://zoom.us/j/..." value={liveForm.meeting_url} onChange={(e) => setLiveForm({ ...liveForm, meeting_url: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Platform (optional)</Label><Input value={liveForm.platform} onChange={(e) => setLiveForm({ ...liveForm, platform: e.target.value })} placeholder="Zoom / Google Meet / YouTube Live" /></div>
                    <label className="flex items-center justify-between text-sm"><span>Make public</span><Switch checked={liveForm.is_public} onCheckedChange={(v) => setLiveForm({ ...liveForm, is_public: v })} /></label>

                    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                      <label className="flex items-center justify-between text-sm">
                        <span className="font-medium">Auto convert to recording</span>
                        <Switch checked={liveForm.auto_convert} onCheckedChange={(v) => setLiveForm({ ...liveForm, auto_convert: v })} />
                      </label>

                      {liveForm.auto_convert && (
                        <>
                          <div className="space-y-2">
                            <Label>Recording visibility</Label>
                            <Select value={liveForm.recording_visibility} onValueChange={(v: any) => setLiveForm({ ...liveForm, recording_visibility: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="immediate">Immediately after class ends</SelectItem>
                                <SelectItem value="delayed">After a delay</SelectItem>
                                <SelectItem value="permanent_hidden">Permanent (never publish)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {liveForm.recording_visibility === "delayed" && (
                            <div className="grid grid-cols-2 gap-2">
                              <Input type="number" min="1" value={liveForm.delay_value} onChange={(e) => setLiveForm({ ...liveForm, delay_value: e.target.value })} />
                              <Select value={liveForm.delay_unit} onValueChange={(v: any) => setLiveForm({ ...liveForm, delay_unit: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hours">Hours</SelectItem>
                                  <SelectItem value="days">Days</SelectItem>
                                  <SelectItem value="months">Months</SelectItem>
                                  <SelectItem value="years">Years</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="pt-2 border-t space-y-2">
                            <label className="flex items-center justify-between text-sm">
                              <span>Hide recording after</span>
                              <Switch checked={!liveForm.hide_never} onCheckedChange={(v) => setLiveForm({ ...liveForm, hide_never: !v })} />
                            </label>
                            {!liveForm.hide_never ? (
                              <div className="grid grid-cols-2 gap-2">
                                <Input type="number" min="1" value={liveForm.hide_value} onChange={(e) => setLiveForm({ ...liveForm, hide_value: e.target.value })} />
                                <Select value={liveForm.hide_unit} onValueChange={(v: any) => setLiveForm({ ...liveForm, hide_unit: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="days">Days</SelectItem>
                                    <SelectItem value="months">Months</SelectItem>
                                    <SelectItem value="years">Years</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Recording will remain visible forever.</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <Button type="submit" className="w-full">{editingLiveId ? "Update" : "Schedule"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          )}
          {live.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No upcoming classes.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {live.map((l) => {
                const dt = new Date(l.scheduled_at);
                const status = liveStatus(l);
                return (
                  <Card key={l.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{l.title}</h4>
                          {l.platform && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{l.platform}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${status.tone}`}>{status.label}</span>
                          {l.auto_convert_to_recording && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">Auto→Rec</span>
                          )}
                          {l.is_public ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        {l.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
                        <p className="text-sm text-muted-foreground mt-1">{format(dt, "PP p")} · {l.duration_minutes} min</p>
                        <a href={l.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1 mt-1">
                          <ExternalLink className="h-3.5 w-3.5" />Join link
                        </a>
                        {l.converted_recording_id && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />Converted to recording
                          </p>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => editLive(l)}>Edit</Button>
                          <button onClick={() => deleteLive(l.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Media;
