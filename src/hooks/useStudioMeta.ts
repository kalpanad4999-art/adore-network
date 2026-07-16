import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StudioMeta = {
  ownerId: string | null;
  studioName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
};

const DEFAULTS: StudioMeta = {
  ownerId: null,
  studioName: "TRINETRA YOGA",
  logoUrl: null,
  backgroundUrl: null,
};

/**
 * Public studio metadata for pages that don't have an auth session yet
 * (sign-in, public share pages). When `ownerId` is provided we fetch that
 * studio; otherwise we fall back to the primary studio owner.
 */
export const useStudioMeta = (ownerId?: string | null): StudioMeta => {
  const [meta, setMeta] = useState<StudioMeta>(DEFAULTS);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rpc = ownerId
          ? supabase.rpc("get_public_studio_meta", { _owner: ownerId })
          : supabase.rpc("get_default_studio_meta");
        const { data } = await rpc;
        const row = Array.isArray(data) ? data[0] : data;
        if (alive && row) {
          setMeta({
            ownerId: (row as any).owner_id ?? ownerId ?? null,
            studioName: (row as any).studio_name || DEFAULTS.studioName,
            logoUrl: (row as any).logo_url ?? null,
            backgroundUrl: (row as any).background_url ?? null,
          });
        }
      } catch { /* silent — fall back to defaults */ }
    })();
    return () => { alive = false; };
  }, [ownerId]);
  return meta;
};

/** Set <link rel="icon"> and document.title from a studio's logo/name. */
export const applyStudioBranding = (name: string | null, logoUrl: string | null) => {
  if (typeof document === "undefined") return;
  if (name) document.title = `${name} — Studio Management`;
  if (!logoUrl) return;
  const head = document.head;
  head.querySelectorAll("link[rel~='icon']").forEach((el) => el.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = logoUrl;
  head.appendChild(link);
  const apple = document.createElement("link");
  apple.rel = "apple-touch-icon";
  apple.href = logoUrl;
  head.appendChild(apple);
};
