/**
 * App version detection.
 *
 * Vite emits hashed asset filenames on every deploy, so the set of script/style
 * URLs referenced by index.html is a reliable build fingerprint. We fetch the
 * deployed index.html with cache-busting and compare the fingerprint against the
 * one the running app booted with.
 */

const STORAGE_KEY = "trinetra.app.buildId";
export const AUTO_UPDATE_KEY = "trinetra.app.autoUpdate";

const hashString = (input: string) => {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

const fingerprintFromHtml = (html: string) => {
  const refs = Array.from(html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)).map((m) => m[1]);
  const unique = Array.from(new Set(refs)).sort();
  return unique.length ? hashString(unique.join("|")) : hashString(html.length + "");
};

/** Fingerprint of the build currently running in this tab (from the live DOM). */
export const currentBuildId = (): string => {
  if (typeof document === "undefined") return "dev";
  const refs = Array.from(document.querySelectorAll<HTMLElement>("script[src], link[rel=stylesheet][href]"))
    .map((el) => el.getAttribute("src") || el.getAttribute("href") || "")
    .filter(Boolean);
  const unique = Array.from(new Set(refs)).sort();
  return unique.length ? hashString(unique.join("|")) : "dev";
};

/** Fingerprint of the build currently deployed on the server. */
export const fetchDeployedBuildId = async (): Promise<string | null> => {
  try {
    const res = await fetch(`/index.html?_v=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.toLowerCase().includes("<html")) return null;
    return fingerprintFromHtml(html);
  } catch {
    return null;
  }
};

export const getKnownBuildId = () => {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
};

export const rememberBuildId = (id: string) => {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
};

export const isAutoUpdateEnabled = () => {
  try { return localStorage.getItem(AUTO_UPDATE_KEY) !== "off"; } catch { return true; }
};

export const setAutoUpdateEnabled = (enabled: boolean) => {
  try { localStorage.setItem(AUTO_UPDATE_KEY, enabled ? "on" : "off"); } catch { /* ignore */ }
};

/** Clear caches + service workers, then hard-reload onto the newest deploy. */
export const applyUpdate = async () => {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
  } catch { /* ignore */ }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
  try { sessionStorage.removeItem("trinetra.app.autoUpdateDone"); } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString(36));
  window.location.replace(url.toString());
};
