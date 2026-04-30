import { useRef, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Upload, Trash2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const {
    studioName, logoUrl, backgroundUrl, isOwner, paymentsPinSet,
    uploadLogo, uploadBackground, removeBackground, setPaymentsPin,
  } = useStudio();
  const logoRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  if (!isOwner) {
    return (
      <Card className="max-w-xl">
        <CardContent className="py-10 text-center text-muted-foreground">
          Only the studio owner can manage settings.
        </CardContent>
      </Card>
    );
  }

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return; }
    try { await uploadLogo(file); toast.success("Logo updated"); }
    catch { toast.error("Failed to upload logo"); }
    e.target.value = "";
  };

  const handleBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    try { await uploadBackground(file); toast.success("Background updated"); }
    catch { toast.error("Failed to upload background"); }
    e.target.value = "";
  };

  const handleRemoveBg = async () => {
    await removeBackground();
    toast.success("Background removed");
  };

  const handlePinSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) { toast.error("PIN must be 4–6 digits"); return; }
    if (pin !== confirmPin) { toast.error("PINs do not match"); return; }
    setSavingPin(true);
    await setPaymentsPin(pin);
    setSavingPin(false);
    setPin(""); setConfirmPin("");
    toast.success("Payments PIN saved");
  };

  const handlePinClear = async () => {
    await setPaymentsPin(null);
    toast.success("Payments PIN removed");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl md:text-4xl text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your studio's look and security.</p>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Studio Logo</CardTitle>
          <CardDescription>Shown on this Settings page. Recommended square PNG, under 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-xl border bg-muted flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt={`${studioName} logo`} className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">{studioName}</p>
              <p className="text-sm text-muted-foreground">{logoUrl ? "Click to replace" : "No logo uploaded"}</p>
            </div>
          </div>
          <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogo} />
          <Button onClick={() => logoRef.current?.click()} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> {logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
        </CardContent>
      </Card>

      {/* Background */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">App Background</CardTitle>
          <CardDescription>Set a custom background image used across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video w-full rounded-xl border bg-muted overflow-hidden">
            {backgroundUrl ? (
              <img src={backgroundUrl} alt="App background" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                No background set
              </div>
            )}
          </div>
          <input ref={bgRef} type="file" accept="image/*" hidden onChange={handleBackground} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => bgRef.current?.click()} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" /> {backgroundUrl ? "Replace background" : "Upload background"}
            </Button>
            {backgroundUrl && (
              <Button onClick={handleRemoveBg} variant="ghost" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments PIN */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><Lock className="h-5 w-5" /> Payments Security PIN</CardTitle>
          <CardDescription>
            {paymentsPinSet
              ? "A PIN is set. Anyone opening Payments will need to enter it."
              : "Set a 4–6 digit PIN to lock the Payments page."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentsPinSet && (
            <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Payments page is locked
            </div>
          )}
          <form onSubmit={handlePinSave} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{paymentsPinSet ? "New PIN" : "PIN"}</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="4–6 digits"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Repeat PIN"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingPin}>
                {savingPin ? "Saving…" : paymentsPinSet ? "Update PIN" : "Set PIN"}
              </Button>
              {paymentsPinSet && (
                <Button type="button" variant="ghost" onClick={handlePinClear} className="text-destructive hover:text-destructive">
                  Remove PIN
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
