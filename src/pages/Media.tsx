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
import { Image as ImageIcon, Video, Radio, Plus, Trash2, ExternalLink, Upload, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Gallery = { id: string; title: string | null; description: string | null; media_type: "image" | "video"; storage_path: string; thumbnail_path: string | null; is_public: boolean; created_at: string };
type Recording = { id: string; title: string; description: string | null; storage_path: string | null; external_url: string | null; duration_minutes: number | null; recorded_on: string | null; is_public: boolean; created_at: string };
type Live = { id: string; title: string; description: string | null; scheduled_at: string; duration_minutes: number; meeting_url: string; platform: string | null; is_public: boolean };

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

const MediaThumb = ({ item }: { item: Gallery }) => {
  const url = useSignedUrl("studio-gallery", item.thumbnail_path || item.storage_path);
  if (!url) return <div className="aspect-square bg-muted animate-pulse rounded-md" />;
  return item.media_type === "image" ? (
    <img src={url} alt={item.title || "media"} className="aspect-square w-full object-cover rounded-md" loading="lazy" />
  ) : (
    <video src={url} className="aspect-square w-full object-cover rounded-md bg-black" muted playsInline />
  );
};

const RecordingCard = ({ r, onDelete, onTogglePublic }: { r: Recording; onDelete: () => void; onTogglePublic: (v: boolean) => void }) => {
  const url = useSignedUrl("studio-recordings", r.storage_path);
  const link = r.external_url || url;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="font-medium truncate">{r.title}</h4>
            {r.description && <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
            <p className="text-xs text-muted-foreground mt-1">
              {r.recorded_on ? format(new Date(r.recorded_on), "PP") : "—"}
              {r.duration_minutes ? ` · ${r.duration_minutes} min` : ""}
            </p>
          </div>
          <button onClick={onDelete} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
        {r.storage_path && url && <video src={url} controls className="w-full rounded-md bg-black" />}
        {r.external_url && (
          <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" />Open recording
          </a>
        )}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {r.is_public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {r.is_public ? "Public" : "Private"}
          </div>
          <Switch checked={r.is_public} onCheckedChange={onTogglePublic} />
        </div>
      </CardContent>
    </Card>
  );
};

const Media = () => {
  const { user } = useAuth();
  const { ownerId } = useStudio();
  const workspaceId = ownerId || user?.id || null;

  const [gallery, setGallery] = useState<Gallery[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [live, setLive] = useState<Live[]>([]);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const recordingInputRef = useRef<HTMLInputElement>(null);

  const [recOpen, setRecOpen] = useState(false);
  const [recForm, setRecForm] = useState({ title: "", description: "", external_url: "", duration_minutes: "", recorded_on: "", is_public: false });

  const [liveOpen, setLiveOpen] = useState(false);
  const [editingLiveId, setEditingLiveId] = useState<string | null>(null);
  const [liveForm, setLiveForm] = useState({ title: "", description: "", scheduled_at: "", duration_minutes: "60", meeting_url: "", platform: "", is_public: false });

  const fetchAll = async () => {
    if (!user) return;
    const [g, r, l] = await Promise.all([
      supabase.from("gallery_items").select("*").order("created_at", { ascending: false }),
      supabase.from("recordings").select("*").order("created_at", { ascending: false }),
      supabase.from("live_classes").select("*").order("scheduled_at", { ascending: true }),
    ]);
    setGallery((g.data as Gallery[]) || []);
    setRecordings((r.data as Recording[]) || []);
    setLive((l.data as Live[]) || []);
  };

  useEffect(() => { fetchAll(); }, [user]);

  // ---------- Gallery ----------
  const uploadGalleryFiles = async (files: FileList | null) => {
    if (!files || !workspaceId || !user) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) { toast.error(`${file.name}: unsupported type`); continue; }
      if (file.size > 100 * 1024 * 1024) { toast.error(`${file.name}: max 100MB`); continue; }
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("studio-gallery").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); continue; }
      const { error } = await supabase.from("gallery_items").insert({
        user_id: user.id, media_type: isImage ? "image" : "video", storage_path: path, title: file.name,
      });
      if (error) toast.error(error.message);
    }
    toast.success("Upload complete");
    fetchAll();
  };

  const deleteGallery = async (item: Gallery) => {
    if (!confirm("Delete this item?")) return;
    await supabase.storage.from("studio-gallery").remove([item.storage_path]);
    await supabase.from("gallery_items").delete().eq("id", item.id);
    fetchAll();
  };

  const toggleGalleryPublic = async (item: Gallery, v: boolean) => {
    await supabase.from("gallery_items").update({ is_public: v }).eq("id", item.id);
    fetchAll();
  };

  // ---------- Recordings ----------
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

  // ---------- Live classes ----------
  const submitLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const title = liveForm.title.trim();
    if (!title) { toast.error("Title required"); return; }
    if (!liveForm.scheduled_at) { toast.error("Date & time required"); return; }
    if (!/^https?:\/\//i.test(liveForm.meeting_url)) { toast.error("Valid meeting URL required"); return; }
    const payload = {
      user_id: user.id, title, description: liveForm.description.trim() || null,
      scheduled_at: new Date(liveForm.scheduled_at).toISOString(),
      duration_minutes: Number(liveForm.duration_minutes) || 60,
      meeting_url: liveForm.meeting_url.trim(),
      platform: liveForm.platform.trim() || null,
      is_public: liveForm.is_public,
    };
    const { error } = editingLiveId
      ? await supabase.from("live_classes").update(payload).eq("id", editingLiveId)
      : await supabase.from("live_classes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingLiveId ? "Updated" : "Scheduled");
    setLiveOpen(false); setEditingLiveId(null);
    setLiveForm({ title: "", description: "", scheduled_at: "", duration_minutes: "60", meeting_url: "", platform: "", is_public: false });
    fetchAll();
  };

  const deleteLive = async (id: string) => {
    if (!confirm("Cancel this class?")) return;
    await supabase.from("live_classes").delete().eq("id", id);
    fetchAll();
  };

  const editLive = (l: Live) => {
    setEditingLiveId(l.id);
    setLiveForm({
      title: l.title, description: l.description || "",
      scheduled_at: format(new Date(l.scheduled_at), "yyyy-MM-dd'T'HH:mm"),
      duration_minutes: String(l.duration_minutes), meeting_url: l.meeting_url,
      platform: l.platform || "", is_public: l.is_public,
    });
    setLiveOpen(true);
  };

  const copyPublicLink = () => {
    if (!workspaceId) return;
    const url = `${window.location.origin}/studio/${workspaceId}`;
    navigator.clipboard.writeText(url);
    toast.success("Public studio link copied");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground mt-1">Recordings and live online classes</p>
        </div>
        <Button variant="outline" onClick={copyPublicLink}><Copy className="h-4 w-4 mr-2" />Copy public link</Button>
      </div>

      <Tabs defaultValue="recordings" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="recordings"><Video className="h-4 w-4 mr-2" />Recordings</TabsTrigger>
          <TabsTrigger value="live"><Radio className="h-4 w-4 mr-2" />Live</TabsTrigger>
        </TabsList>

        {/* RECORDINGS */}
        <TabsContent value="recordings" className="space-y-4">
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
          {recordings.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No recordings yet.</CardContent></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {recordings.map((r) => (
                <RecordingCard key={r.id} r={r} onDelete={() => deleteRecording(r)} onTogglePublic={async (v) => { await supabase.from("recordings").update({ is_public: v }).eq("id", r.id); fetchAll(); }} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* LIVE */}
        <TabsContent value="live" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={liveOpen} onOpenChange={(v) => { if (!v) { setLiveOpen(false); setEditingLiveId(null); } else setLiveOpen(true); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Schedule live class</Button></DialogTrigger>
              <DialogContent>
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
                  <Button type="submit" className="w-full">{editingLiveId ? "Update" : "Schedule"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          {live.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No upcoming classes.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {live.map((l) => {
                const dt = new Date(l.scheduled_at);
                const upcoming = dt.getTime() > Date.now();
                return (
                  <Card key={l.id}>
                    <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{l.title}</h4>
                          {l.platform && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{l.platform}</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${upcoming ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                            {upcoming ? "Upcoming" : "Past"}
                          </span>
                          {l.is_public ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        {l.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
                        <p className="text-sm text-muted-foreground mt-1">{format(dt, "PP p")} · {l.duration_minutes} min</p>
                        <a href={l.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1 mt-1">
                          <ExternalLink className="h-3.5 w-3.5" />Join link
                        </a>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => editLive(l)}>Edit</Button>
                        <button onClick={() => deleteLive(l.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
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
