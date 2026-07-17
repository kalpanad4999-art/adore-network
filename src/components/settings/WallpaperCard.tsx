import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Paintbrush, Trash2 } from "lucide-react";
import { clearWallpaper, fileToWallpaperDataUrl, setWallpaper, useWallpaper } from "@/hooks/useWallpaper";

const PRESET_COLORS = [
  "#0B1F3A", "#1E293B", "#3B82F6", "#0EA5E9",
  "#059669", "#B4531F", "#C9A24B", "#7C3AED",
  "#DB2777", "#DC2626", "#FBF7F0", "#FFFFFF",
];

const WallpaperCard = () => {
  const wp = useWallpaper();
  const fileRef = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState<string>(wp.color || "#0B1F3A");
  const [busy, setBusy] = useState(false);

  const onPickImage = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB"); return; }
    setBusy(true);
    try {
      const dataUrl = await fileToWallpaperDataUrl(file);
      setWallpaper({ mode: "image", image: dataUrl });
      toast.success("Wallpaper applied");
    } catch (e: any) {
      toast.error(e?.message || "Could not set wallpaper");
    } finally { setBusy(false); }
  };

  const applyColor = () => {
    setWallpaper({ mode: "color", color });
    toast.success("Background color applied");
  };

  const removeWallpaper = () => {
    clearWallpaper();
    toast.success("Wallpaper removed");
  };

  return (
    <div className="space-y-4">
      {/* Preview */}
      <Card className="overflow-hidden">
        <div
          className="h-28 w-full"
          style={
            wp.mode === "image" && wp.image
              ? { backgroundImage: `url(${wp.image})`, backgroundSize: "cover", backgroundPosition: "center" }
              : wp.mode === "color" && wp.color
              ? { background: wp.color }
              : { background: "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--background)) 100%)" }
          }
        />
        <CardContent className="py-3 flex items-center justify-between gap-2">
          <div className="text-sm">
            <div className="font-medium capitalize">
              {wp.mode === "none" ? "Default" : wp.mode}
            </div>
            <div className="text-xs text-muted-foreground">
              {wp.mode === "color" && wp.color ? wp.color : wp.mode === "image" ? "Custom image" : "No wallpaper set"}
            </div>
          </div>
          {wp.mode !== "none" && (
            <Button variant="ghost" size="sm" onClick={removeWallpaper}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Choose from Gallery */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-primary" /> Choose from Gallery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Upload an image from your device to use as the app wallpaper.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && onPickImage(e.target.files[0])}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus className="h-4 w-4 mr-2" /> {busy ? "Applying…" : "Upload Image"}
          </Button>
        </CardContent>
      </Card>

      {/* Set Color */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paintbrush className="h-4 w-4 text-primary" /> Set Color
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-16 p-1 cursor-pointer"
            />
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="max-w-[140px]" />
            <Button onClick={applyColor}>Apply</Button>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => { setColor(c); setWallpaper({ mode: "color", color: c }); }}
                  className="h-8 w-8 rounded-full border-2 border-border hover:scale-110 transition-transform"
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WallpaperCard;
