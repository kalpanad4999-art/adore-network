/**
 * App version detection.
 *
 * Vite emits a hashed entry bundle on every deploy, so the entry script URL in
 * index.html is a reliable build fingerprint.
 *
 * IMPORTANT: the running page's DOM contains extra scripts/styles that are NOT
 * in index.html (dynamically imported route chunks, injected badge scripts,
 * runtime-inserted <style>/<link> tags). Fingerprinting the whole DOM therefore
 * never matched the fingerprint of the fetched index.html, which made the app
 * report "update available" forever (and auto-reload in a loop). We now compare
 * only the build's entry assets, extracted the same way on both sides.
 */

const STORAGE_KEY = "trinetra.app.buildId";
export const AUTO_UPDATE_KEY = "trinetra.app.autoUpdate";

const hashString = (input: string) => {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

/** `/assets/index-B1x9.js?foo` -> `index-B1x9.js`; anything else -> null. */
const assetFile = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const clean = url.split("?")[0].split("#")[0];
  if (!/\/assets\//.test(clean)) return null;
  const file = clean.substring(clean.lastIndexOf("/") + 1);
  return /\.(js|css)$/.test(file) && /-[A-Za-z0-9_]{6,}\.(js|css)$/.test(file) ? file : null;
};

const idFromFiles = (files: (string | null)[]): string | null => {
  const unique = Array.from(new Set(files.filter(Boolean) as string[])).sort();
  return unique.length ? hashString(unique.join("|")) : null;
};

/** Entry assets referenced directly by the deployed index.html. */
const fingerprintFromHtml = (html: string): string | null => {
  const refs = Array.from(html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)).map((m) => m[1]);
  return idFromFiles(refs.map(assetFile));
};

/**
 * Fingerprint of the build running in this tab. Only the entry <script
 * type="module"> and the stylesheet links emitted by the build are used, so it
 * matches what index.html declares.
 */
export const currentBuildId = (): string | null => {
  if (typeof document === "undefined") return null;
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      "script[type='module'][src], link[rel='modulepreload'][href], link[rel='stylesheet'][href]",
    ),
  );
  return idFromFiles(nodes.map((el) => assetFile(el.getAttribute("src") || el.getAttribute("href"))));
};

/** Fingerprint of the build currently deployed on the server. */
export const fetchDeployedBuildId = async (): Promise<string | null> => {
  try {
    // `cache: reload` bypasses HTTP cache *and* any service-worker cache entry,
    // so a freshly published deploy is always seen.
    const res = await fetch(`/index.html?_v=${Date.now()}`, {
      cache: "reload",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.toLowerCase().includes("<html")) return null;
    return fingerprintFromHtml(html);
  } catch {
    return null;
  }
};

/**
 * Baseline for comparison: the build actually running in this tab, falling back
 * to the last id we stored (e.g. if the DOM lookup yields nothing).
 */
export const getKnownBuildId = (): string | null => {
  const live = currentBuildId();
  if (live) return live;
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
