import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudio } from "@/contexts/StudioContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, Trash2, Upload, Eye, EyeOff, Copy } from "lucide-react";
import { toast } from "sonner";

type Gallery = { id: string; title: string | null; description: string | null; media_type: "image" | "video"; storage_path: string; thumbnail_path: string | null; is_public: boolean; created_at: string };

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

const GalleryPage = () => {
  const { user } = useAuth();
  const { ownerId } = useStudio();
  const workspaceId = ownerId || user?.id || null;
  const [items, setItems] = useState<Gallery[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchAll = async () => {
    if (!user) return;
    const { data } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false });
    setItems((data as Gallery[]) || []);
  };

  useEffect(() => { fetchAll(); }, [user]);

  const upload = async (files: FileList | null) => {
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
          <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => upload(e.target.files)} />
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
    </div>
  );
};

export default GalleryPage;
