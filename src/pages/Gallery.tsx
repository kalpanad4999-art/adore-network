import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon, Trash2, Upload, Eye, EyeOff, Copy, Clock, Infinity as InfinityIcon, QrCode, X } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import ShareLinkDialog from "@/components/ShareLinkDialog";

type Gallery = { id: string; title: string | null; description: string | null; media_type: "image" | "video"; storage_path: string; thumbnail_path: string | null; is_public: boolean; created_at: string; expires_at: string | null; expiry_action: "hide" | "delete" };

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

type QuickOption = { label: string; hours: number };
const QUICK_OPTIONS: QuickOption[] = [
  { label: "1 Hour", hours: 1 },
  { label: "6 Hours", hours: 6 },
  { label: "12 Hours", hours: 12 },
  { label: "24 Hours", hours: 24 },
  { label: "3 Days", hours: 24 * 3 },
  { label: "7 Days", hours: 24 * 7 },
  { label: "30 Days", hours: 24 * 30 },
];

const GalleryPage = () => {
  const { user } = useAuth();
  const { ownerId } = useStudio();
  const workspaceId = ownerId || user?.id || null;
  const [items, setItems] = useState<Gallery[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Upload dialog state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"forever" | "quick" | "custom">("quick");
  const [quickHours, setQuickHours] = useState<number>(24);
  const [customDateTime, setCustomDateTime] = useState<string>("");
  const [expiryAction, setExpiryAction] = useState<"hide" | "delete">("hide");
  const [uploading, setUploading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    // Run cleanup then fetch
    await supabase.rpc("cleanup_expired_gallery", { _owner: user.id });
    const { data } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false });
    setItems((data as Gallery[]) || []);
  };

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60_000); // hourly-ish refresh for expirations
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const openDialogForFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => {
      const ok = f.type.startsWith("image/") || f.type.startsWith("video/");
      if (!ok) { toast.error(`${f.name}: unsupported type`); return false; }
      if (f.size > 200 * 1024 * 1024) { toast.error(`${f.name}: max 200MB`); return false; }
      return true;
    });
    if (arr.length === 0) return;
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPendingFiles(arr);
    setPreviews(arr.map((f) => URL.createObjectURL(f)));
    setMode("quick");
    setQuickHours(24);
    setCustomDateTime("");
    setExpiryAction("hide");
    setDialogOpen(true);
  };

  const removePending = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    const nextFiles = pendingFiles.filter((_, i) => i !== idx);
    const nextPreviews = previews.filter((_, i) => i !== idx);
    setPendingFiles(nextFiles);
    setPreviews(nextPreviews);
    if (nextFiles.length === 0) setDialogOpen(false);
  };

  const computedExpiry = (): Date | null => {
    if (mode === "forever") return null;
    if (mode === "quick") return new Date(Date.now() + quickHours * 3600 * 1000);
    if (mode === "custom" && customDateTime) {
      const d = new Date(customDateTime);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const confirmUpload = async () => {
    if (!workspaceId || !user) return;
    const expiry = computedExpiry();
    if (mode === "custom" && !expiry) { toast.error("Pick a valid date & time"); return; }
    if (expiry && expiry.getTime() <= Date.now()) { toast.error("Expiry must be in the future"); return; }

    setUploading(true);
    let ok = 0;
    for (const file of pendingFiles) {
      const isImage = file.type.startsWith("image/");
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${workspaceId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("studio-gallery").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); continue; }
      const { error } = await supabase.from("gallery_items").insert({
        user_id: user.id,
        media_type: isImage ? "image" : "video",
        storage_path: path,
        title: file.name,
        expires_at: expiry ? expiry.toISOString() : null,
        expiry_action: expiryAction,
      });
      if (error) { toast.error(error.message); continue; }
      ok++;
    }
    setUploading(false);
    setDialogOpen(false);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
    setPendingFiles([]);
    if (ok > 0) toast.success(`Uploaded ${ok} item${ok > 1 ? "s" : ""}`);
    fetchAll();
  };

  const del = async (item: Gallery) => {
    if (!confirm("Delete this item?")) return;
    await supabase.storage.from("studio-gallery").remove([item.storage_path]);
    await supabase.from("gallery_items").delete().eq("id", item.id);
    fetchAll();
  };

  const togglePublic = async (item: Gallery, v: boolean) => {
    await supabase.from("gallery_items").update({ is_public: v }).eq("id", item.id);
    fetchAll();
  };

  const copyPublicLink = () => {
    if (!workspaceId) return;
    const url = `${window.location.origin}/studio/${workspaceId}`;
    navigator.clipboard.writeText(url);
    toast.success("Public studio link copied");
  };

  const expiry = computedExpiry();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <ImageIcon className="h-7 w-7" /> My Gallery
          </h1>
          <p className="text-muted-foreground mt-1">Your studio photos and videos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={copyPublicLink}><Copy className="h-4 w-4 mr-2" />Copy public link</Button>
          <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { openDialogForFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }} />
          <Button onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No items yet — upload your first photo or video.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((g) => (
            <div key={g.id} className="group relative">
              <MediaThumb item={g} />
              {g.expires_at && (
                <span className="absolute top-2 left-2 bg-background/90 rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNowStrict(new Date(g.expires_at), { addSuffix: true })}
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-md flex flex-col justify-between p-2">
                <div className="flex justify-between">
                  <button onClick={() => togglePublic(g, !g.is_public)} className="bg-background/90 rounded-full p-1.5" title={g.is_public ? "Public" : "Private"}>
                    {g.is_public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => del(g)} className="bg-background/90 rounded-full p-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <span className="text-xs text-white truncate">{g.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visibility duration dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!uploading) setDialogOpen(v); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2"><Clock className="h-5 w-5" /> Visibility Duration</DialogTitle>
            <DialogDescription>
              {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} selected. Choose how long they stay visible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="space-y-2">
              <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${mode === "quick" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value="quick" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Quick duration</div>
                  <div className="text-xs text-muted-foreground">Pick a preset window</div>
                </div>
              </label>
              <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${mode === "custom" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value="custom" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Custom date & time</div>
                  <div className="text-xs text-muted-foreground">Set an exact expiry</div>
                </div>
              </label>
              <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition ${mode === "forever" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <RadioGroupItem value="forever" />
                <div className="flex-1 flex items-center gap-2">
                  <InfinityIcon className="h-4 w-4" />
                  <div>
                    <div className="text-sm font-medium">Keep forever</div>
                    <div className="text-xs text-muted-foreground">No expiry</div>
                  </div>
                </div>
              </label>
            </RadioGroup>

            {mode === "quick" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUICK_OPTIONS.map((o) => (
                  <Button
                    key={o.hours}
                    type="button"
                    variant={quickHours === o.hours ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuickHours(o.hours)}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            )}

            {mode === "custom" && (
              <div className="space-y-2">
                <Label>Expiry date & time</Label>
                <Input
                  type="datetime-local"
                  value={customDateTime}
                  min={format(new Date(Date.now() + 5 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                />
              </div>
            )}

            {mode !== "forever" && (
              <div className="space-y-2">
                <Label className="text-xs">When it expires</Label>
                <RadioGroup value={expiryAction} onValueChange={(v) => setExpiryAction(v as "hide" | "delete")} className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${expiryAction === "hide" ? "border-primary bg-primary/5" : ""}`}>
                    <RadioGroupItem value="hide" />
                    <EyeOff className="h-4 w-4" /> Hide
                  </label>
                  <label className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${expiryAction === "delete" ? "border-destructive bg-destructive/5" : ""}`}>
                    <RadioGroupItem value="delete" />
                    <Trash2 className="h-4 w-4" /> Delete
                  </label>
                </RadioGroup>
              </div>
            )}

            <div className="rounded-lg bg-muted/60 p-3 text-sm flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Selected expiry</div>
                <div className="font-medium">
                  {expiry
                    ? `${format(expiry, "PPp")} · ${formatDistanceToNowStrict(expiry, { addSuffix: true })}`
                    : mode === "forever" ? "Never expires" : "—"}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={confirmUpload} disabled={uploading}>
              {uploading ? "Uploading..." : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GalleryPage;
