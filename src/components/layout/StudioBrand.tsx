import { useRef, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Pencil, Upload, Check, X } from "lucide-react";
import { toast } from "sonner";

const StudioBrand = ({ compact = false }: { compact?: boolean }) => {
  const { studioName, logoUrl, isOwner, updateName, uploadLogo } = useStudio();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(studioName);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    await updateName(draft);
    setEditing(false);
    toast.success("Studio name updated");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    try {
      await uploadLogo(file);
      toast.success("Logo updated");
    } catch (err) {
      toast.error("Upload failed");
    }
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3 group min-w-0">
      <button
        type="button"
        onClick={() => isOwner && fileRef.current?.click()}
        disabled={!isOwner}
        aria-label="Change logo"
        className={`relative h-10 w-10 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 ${isOwner ? "cursor-pointer hover:ring-2 hover:ring-primary/40" : ""}`}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={studioName} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display font-bold text-primary">{studioName.charAt(0)}</span>
        )}
        {isOwner && (
          <span className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Upload className="h-3.5 w-3.5 text-background" />
          </span>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditing(false); setDraft(studioName); } }}
              maxLength={60}
              className="font-display text-lg font-bold bg-transparent border-b border-primary outline-none w-full min-w-0"
            />
            <button onClick={handleSave} className="text-success p-1" aria-label="Save"><Check className="h-4 w-4" /></button>
            <button onClick={() => { setEditing(false); setDraft(studioName); }} className="text-muted-foreground p-1" aria-label="Cancel"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className={`font-display font-bold tracking-tight truncate ${compact ? "text-lg" : "text-2xl"}`}>{studioName}</h1>
            {isOwner && (
              <button onClick={() => { setDraft(studioName); setEditing(true); }} aria-label="Edit name" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        
      </div>
    </div>
  );
};

export default StudioBrand;
