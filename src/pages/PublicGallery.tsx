import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon } from "lucide-react";

type G = { id: string; title: string | null; description: string | null; media_type: "image" | "video"; storage_path: string; thumbnail_path: string | null };

const useSigned = (bucket: string, path: string | null) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) return;
    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [bucket, path]);
  return url;
};

const Item = ({ g }: { g: G }) => {
  const url = useSigned("studio-gallery", g.storage_path);
  const thumb = useSigned("studio-gallery", g.thumbnail_path || g.storage_path);
  if (!url) return <div className="aspect-square bg-muted rounded-md animate-pulse" />;
  return g.media_type === "image" ? (
    <img src={thumb || url} alt={g.title || "media"} className="aspect-square w-full object-cover rounded-md" loading="lazy" />
  ) : (
    <video src={url} controls playsInline className="aspect-square w-full object-cover rounded-md bg-black" />
  );
};

const PublicGallery = () => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const [items, setItems] = useState<G[]>([]);
  const [studioName, setStudioName] = useState("Studio");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      const [g, s] = await Promise.all([
        supabase.rpc("get_public_gallery", { _owner: ownerId }),
        supabase.from("studio_settings").select("studio_name").eq("owner_id", ownerId).maybeSingle(),
      ]);
      setItems((g.data as G[]) || []);
      if (s.data?.studio_name) setStudioName(s.data.studio_name);
      setLoading(false);
    })();
  }, [ownerId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-6 px-4 text-center">
        <h1 className="font-display text-4xl">{studioName}</h1>
        <p className="text-muted-foreground mt-1 flex items-center justify-center gap-2"><ImageIcon className="h-4 w-4" /> Gallery</p>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {items.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">No public items yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((it) => <Item key={it.id} g={it} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicGallery;
