import { useRef, useState } from "react";
import { useStudio } from "@/contexts/StudioContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Upload, Trash2, Lock, ShieldCheck, Sun, Moon, Check } from "lucide-react";
import { toast } from "sonner";

const PRESET_WALLPAPERS = [
  { name: "Sunrise Meditation", url: "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1920&q=70" },
  { name: "Forest Calm", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=70" },
  { name: "Mountain Mist", url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=70" },
  { name: "Ocean Breath", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=70" },
  { name: "Zen Stones", url: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1920&q=70" },
  { name: "Lotus Bloom", url: "https://images.unsplash.com/photo-1531171596281-8b5d26917d8b?auto=format&fit=crop&w=1920&q=70" },
];

const Settings = () => {
  const {
    studioName, logoUrl, backgroundUrl, isOwner,
    paymentsPinSet,
    appLockPinSet,
    uploadLogo, uploadBackground, setBackgroundFromUrl, removeBackground,
    setPaymentsPin,
    setAppLockPin,
  } = useStudio();
  const { theme, setTheme } = useTheme();
  const logoRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [appPin, setAppPin] = useState("");
  const [appConfirm, setAppConfirm] = useState("");
  const [savingAppPin, setSavingAppPin] = useState(false);

  const handleAppPinSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(appPin)) { toast.error("PIN must be 4–6 digits"); return; }
    if (appPin !== appConfirm) { toast.error("PINs do not match"); return; }
    setSavingAppPin(true);
    await setAppLockPin(appPin);
    setSavingAppPin(false);
    setAppPin(""); setAppConfirm("");
    toast.success("App lock PIN saved");
  };

  const handleAppPinClear = async () => {
    await setAppLockPin(null);
    toast.success("App lock removed");
  };

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

      {/* Appearance / Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />} Appearance
          </CardTitle>
          <CardDescription>Choose how TRINETRA looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <button
              type="button"
              onClick={() => { setTheme("light"); toast.success("Light mode on"); }}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <Sun className="h-5 w-5" />
              <span className="font-medium">Light</span>
              {theme === "light" && <Check className="h-4 w-4 text-primary ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => { setTheme("dark"); toast.success("Dark mode on"); }}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 transition-all ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <Moon className="h-5 w-5" />
              <span className="font-medium">Dark</span>
              {theme === "dark" && <Check className="h-4 w-4 text-primary ml-1" />}
            </button>
          </div>
        </CardContent>
      </Card>

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

          <div className="space-y-2">
            <Label className="text-sm">Wallpaper presets</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PRESET_WALLPAPERS.map((wp) => {
                const active = backgroundUrl === wp.url;
                return (
                  <button
                    key={wp.url}
                    type="button"
                    onClick={async () => {
                      try { await setBackgroundFromUrl(wp.url); toast.success(`${wp.name} applied`); }
                      catch { toast.error("Failed to apply wallpaper"); }
                    }}
                    className={`group relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}
                  >
                    <img src={wp.url} alt={wp.name} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                      <span className="text-xs text-white font-medium">{wp.name}</span>
                    </div>
                    {active && (
                      <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><Lock className="h-5 w-5" /> App Lock PIN</CardTitle>
          <CardDescription>
            {appLockPinSet
              ? "App lock is on. This PIN is required after sign-in."
              : "Set a 4–6 digit PIN required after sign-in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {appLockPinSet && (
            <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> App is locked after sign-in
            </div>
          )}
          <form onSubmit={handleAppPinSave} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{appLockPinSet ? "New PIN" : "PIN"}</Label>
                <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
                  value={appPin} onChange={(e) => setAppPin(e.target.value.replace(/\D/g, ""))} placeholder="4–6 digits" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm PIN</Label>
                <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6}
                  value={appConfirm} onChange={(e) => setAppConfirm(e.target.value.replace(/\D/g, ""))} placeholder="Repeat PIN" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingAppPin}>
                {savingAppPin ? "Saving…" : appLockPinSet ? "Update PIN" : "Set PIN"}
              </Button>
              {appLockPinSet && (
                <Button type="button" variant="ghost" onClick={handleAppPinClear} className="text-destructive hover:text-destructive">
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
