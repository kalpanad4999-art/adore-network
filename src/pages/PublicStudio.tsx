import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Image as ImageIcon, Video, Radio, ExternalLink } from "lucide-react";
import SupportChatWidget from "@/components/SupportChatWidget";
import { useStudioMeta, applyStudioBranding } from "@/hooks/useStudioMeta";
import { format } from "date-fns";

type G = { id: string; title: string | null; description: string | null; media_type: "image" | "video"; storage_path: string; thumbnail_path: string | null };
type R = { id: string; title: string; description: string | null; storage_path: string | null; external_url: string | null; duration_minutes: number | null; recorded_on: string | null };
type L = { id: string; title: string; description: string | null; scheduled_at: string; duration_minutes: number; meeting_url: string; platform: string | null };

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

const Thumb = ({ g }: { g: G }) => {
  const url = useSigned("studio-gallery", g.thumbnail_path || g.storage_path);
  if (!url) return <div className="aspect-square bg-muted rounded-md animate-pulse" />;
  return g.media_type === "image"
    ? <img src={url} alt={g.title || "media"} className="aspect-square w-full object-cover rounded-md" loading="lazy" />
    : <video src={url} controls className="aspect-square w-full object-cover rounded-md bg-black" />;
};

const RecCard = ({ r }: { r: R }) => {
  const url = useSigned("studio-recordings", r.storage_path);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <h4 className="font-medium">{r.title}</h4>
        {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
        <p className="text-xs text-muted-foreground">{r.recorded_on ? format(new Date(r.recorded_on), "PP") : ""} {r.duration_minutes ? `· ${r.duration_minutes} min` : ""}</p>
        {r.storage_path && url && <video src={url} controls className="w-full rounded-md bg-black" />}
        {r.external_url && <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" />Watch</a>}
      </CardContent>
    </Card>
  );
};

const PublicStudio = () => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const meta = useStudioMeta(ownerId);
  const [g, setG] = useState<G[]>([]);
  const [r, setR] = useState<R[]>([]);
  const [l, setL] = useState<L[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { applyStudioBranding(meta.studioName, meta.logoUrl); }, [meta.studioName, meta.logoUrl]);

  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      const [gr, rr, lr] = await Promise.all([
        supabase.rpc("get_public_gallery", { _owner: ownerId }),
        supabase.rpc("get_public_recordings", { _owner: ownerId }),
        supabase.rpc("get_public_live_classes", { _owner: ownerId }),
      ]);
      setG((gr.data as G[]) || []);
      setR((rr.data as R[]) || []);
      setL((lr.data as L[]) || []);
      setLoading(false);
    })();
  }, [ownerId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-6 px-4 text-center">
        {meta.logoUrl && (
          <img src={meta.logoUrl} alt={meta.studioName} className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-sm" />
        )}
        <h1 className="font-display text-4xl">{meta.studioName}</h1>
        <p className="text-muted-foreground mt-1">Gallery · Recordings · Live Classes</p>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <Tabs defaultValue="gallery">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="gallery"><ImageIcon className="h-4 w-4 mr-2" />Gallery</TabsTrigger>
            <TabsTrigger value="recordings"><Video className="h-4 w-4 mr-2" />Recordings</TabsTrigger>
            <TabsTrigger value="live"><Radio className="h-4 w-4 mr-2" />Live</TabsTrigger>
          </TabsList>
          <TabsContent value="gallery" className="mt-6">
            {g.length === 0 ? <p className="text-center text-muted-foreground py-12">No public items yet.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {g.map((it) => <Thumb key={it.id} g={it} />)}
              </div>
            )}
          </TabsContent>
          <TabsContent value="recordings" className="mt-6">
            {r.length === 0 ? <p className="text-center text-muted-foreground py-12">No public recordings.</p> : (
              <div className="grid sm:grid-cols-2 gap-4">{r.map((it) => <RecCard key={it.id} r={it} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="live" className="mt-6 space-y-3">
            {l.length === 0 ? <p className="text-center text-muted-foreground py-12">No upcoming classes.</p> : l.map((it) => (
              <Card key={it.id}>
                <CardContent className="p-4 flex justify-between items-start gap-3 flex-wrap">
                  <div>
                    <h4 className="font-medium">{it.title}</h4>
                    {it.description && <p className="text-sm text-muted-foreground">{it.description}</p>}
                    <p className="text-sm text-muted-foreground mt-1">{format(new Date(it.scheduled_at), "PP p")} · {it.duration_minutes} min{it.platform ? ` · ${it.platform}` : ""}</p>
                  </div>
                  <a href={it.meeting_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" />Join</a>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
      {ownerId && <SupportChatWidget ownerId={ownerId} />}
    </div>
  );
};

export default PublicStudio;
