import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

type Rec = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  duration_minutes: number | null;
  recorded_on: string | null;
  created_at: string;
};

const PublicRecording = () => {
  const { slug } = useParams<{ slug: string }>();
  const [rec, setRec] = useState<Rec | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) { setState("unavailable"); return; }
      const { data, error } = await supabase.rpc("get_recording_by_slug" as any, { _slug: slug });
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) { setState("unavailable"); return; }
      setRec(row as Rec);
      if ((row as Rec).storage_path) {
        const { data: s } = await supabase.storage.from("studio-recordings").createSignedUrl((row as Rec).storage_path!, 3600);
        if (alive) setVideoUrl(s?.signedUrl ?? null);
      }
      setState("ready");
    })();
    return () => { alive = false; };
  }, [slug]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (state === "unavailable" || !rec) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full"><CardContent className="py-12 text-center">
          <p className="font-display text-xl">This recording is not available yet.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="font-display text-3xl font-bold">{rec.title}</h1>
        <p className="text-sm text-muted-foreground">
          {rec.recorded_on ? format(new Date(rec.recorded_on), "PP") : format(new Date(rec.created_at), "PP")}
          {rec.duration_minutes ? ` · ${rec.duration_minutes} min` : ""}
        </p>
        {rec.storage_path && videoUrl && (
          <video src={videoUrl} controls className="w-full rounded-md bg-black" />
        )}
        {rec.external_url && !rec.storage_path && (
          <a href={rec.external_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Open recording
          </a>
        )}
        {rec.description && <p className="text-base leading-relaxed">{rec.description}</p>}
      </div>
    </div>
  );
};

export default PublicRecording;
