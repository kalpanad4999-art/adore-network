import { useRef, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, FileText, Loader2 } from "lucide-react";

const TermsConditionsCard = () => {
  const { termsEnabled, termsImageUrl, uploadTermsImage, removeTermsImage, setTermsEnabled } = useStudio();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Only PNG or JPG images are allowed");
      return;
    }
    setUploading(true);
    try {
      await uploadTermsImage(file);
      setImgError(false);
      toast.success("Terms & Conditions image updated");
    } catch {
      toast.error("Upload failed — please try again");
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (on: boolean) => {
    if (on && !termsImageUrl) {
      toast.error("Upload a Terms & Conditions image first");
      return;
    }
    setToggling(true);
    try {
      await setTermsEnabled(on);
      toast.success(on ? "Terms & Conditions enabled on registration forms" : "Terms & Conditions disabled");
    } catch {
      toast.error("Could not update setting");
    } finally {
      setToggling(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeTermsImage();
      toast.success("Terms & Conditions image removed");
    } catch {
      toast.error("Could not remove image");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Terms & Conditions</CardTitle>
        <CardDescription>
          Upload an image of your Terms & Conditions. When enabled, every registration form shows an
          "I agree to the Terms & Conditions" checkbox that members must tick before submitting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="terms-toggle" className="text-base font-semibold">Show on registration forms</Label>
            <p className="text-sm text-muted-foreground">
              {termsEnabled ? "Members must agree before they can submit." : "The agreement section is hidden."}
            </p>
          </div>
          <Switch
            id="terms-toggle"
            checked={termsEnabled}
            disabled={toggling}
            onCheckedChange={handleToggle}
            aria-label="Toggle Terms & Conditions"
          />
        </div>

        {termsImageUrl ? (
          <div className="space-y-3">
            {imgError ? (
              <div className="rounded-xl border-2 border-dashed border-destructive/40 p-6 text-center space-y-1">
                <p className="font-medium text-destructive">This image could not be loaded</p>
                <p className="text-sm text-muted-foreground">
                  It may have been deleted from storage. Please upload a new Terms &amp; Conditions image.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden bg-muted/30 max-h-80 overflow-y-auto">
                <img
                  src={termsImageUrl}
                  alt="Terms and Conditions"
                  className="w-full object-contain"
                  onError={() => setImgError(true)}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Change Image
              </Button>
              <Button variant="ghost" className="text-destructive" onClick={handleRemove} disabled={uploading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploading ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileText className="h-8 w-8" />}
            <span className="font-medium">{uploading ? "Uploading..." : "Upload Terms & Conditions image"}</span>
            <span className="text-xs">PNG or JPG, up to 5MB</span>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFile} />
      </CardContent>
    </Card>
  );
};

export default TermsConditionsCard;
