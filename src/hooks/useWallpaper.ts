import { useEffect, useState } from "react";

// Per-user localStorage keys (kept small & simple — no DB needed)
const KEY_IMAGE = "wallpaper_image_v1";
const KEY_COLOR = "wallpaper_color_v1";
const KEY_MODE = "wallpaper_mode_v1"; // "image" | "color" | "none"
const EVT = "wallpaper-change";

export type WallpaperMode = "none" | "image" | "color";

export type WallpaperState = {
  mode: WallpaperMode;
  image: string | null;
  color: string | null;
};

const read = (): WallpaperState => ({
  mode: (localStorage.getItem(KEY_MODE) as WallpaperMode) || "none",
  image: localStorage.getItem(KEY_IMAGE),
  color: localStorage.getItem(KEY_COLOR),
});

export const setWallpaper = (patch: Partial<WallpaperState>) => {
  if (patch.mode !== undefined) localStorage.setItem(KEY_MODE, patch.mode);
  if (patch.image !== undefined) {
    if (patch.image) localStorage.setItem(KEY_IMAGE, patch.image);
    else localStorage.removeItem(KEY_IMAGE);
  }
  if (patch.color !== undefined) {
    if (patch.color) localStorage.setItem(KEY_COLOR, patch.color);
    else localStorage.removeItem(KEY_COLOR);
  }
  window.dispatchEvent(new Event(EVT));
};

export const clearWallpaper = () => {
  localStorage.removeItem(KEY_MODE);
  localStorage.removeItem(KEY_IMAGE);
  localStorage.removeItem(KEY_COLOR);
  window.dispatchEvent(new Event(EVT));
};

export const useWallpaper = (): WallpaperState => {
  const [state, setState] = useState<WallpaperState>(() => (typeof window === "undefined" ? { mode: "none", image: null, color: null } : read()));
  useEffect(() => {
    const on = () => setState(read());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return state;
};

/** Downscale to max 1600px & JPEG-encode so we stay well within localStorage quota. */
export const fileToWallpaperDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const MAX = 1600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const r = Math.min(MAX / width, MAX / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
