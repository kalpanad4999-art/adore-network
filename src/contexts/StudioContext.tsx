import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

const sha256Hex = async (input: string) => {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

interface StudioContextValue {
  studioName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  paymentsPinSet: boolean;
  appLockPinSet: boolean;
  ownerId: string | null;
  isOwner: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  uploadBackground: (file: File) => Promise<void>;
  setBackgroundFromUrl: (url: string) => Promise<void>;
  removeBackground: () => Promise<void>;
  setPaymentsPin: (pin: string | null) => Promise<void>;
  verifyPaymentsPin: (pin: string) => Promise<boolean>;
  setAppLockPin: (pin: string | null) => Promise<void>;
  verifyAppLockPin: (pin: string) => Promise<boolean>;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export const StudioProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [studioName, setStudioName] = useState("TRINETRA");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [paymentsPinHash, setPaymentsPinHash] = useState<string | null>(null);
  const [appLockPinHash, setAppLockPinHash] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("owner_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    const owner = roleRow?.owner_id || user.id;
    setOwnerId(owner);
    setIsOwner(roleRow?.role === "owner" || !roleRow);
    const { data: settings } = await supabase
      .from("studio_settings")
      .select("*")
      .eq("owner_id", owner)
      .maybeSingle();
    if (settings) {
      const s = settings as any;
      setStudioName(s.studio_name || "TRINETRA");
      setLogoUrl(s.logo_url);
      setBackgroundUrl(s.background_url ?? null);
    }
    // PIN hashes live in an owner-only table; only the owner can read them.
    if (roleRow?.role !== "staff") {
      const { data: sec } = await supabase
        .from("studio_security" as any)
        .select("payments_pin_hash, app_lock_pin_hash")
        .eq("owner_id", owner)
        .maybeSingle();
      const s = (sec ?? {}) as any;
      setPaymentsPinHash(s.payments_pin_hash ?? null);
      setAppLockPinHash(s.app_lock_pin_hash ?? null);
    } else {
      setPaymentsPinHash(null);
      setAppLockPinHash(null);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user]);

  useEffect(() => {
    const root = document.body;
    if (backgroundUrl) {
      root.style.backgroundImage = `url("${backgroundUrl}")`;
      root.style.backgroundSize = "cover";
      root.style.backgroundPosition = "center";
      root.style.backgroundAttachment = "fixed";
      root.style.backgroundRepeat = "no-repeat";
    } else {
      root.style.backgroundImage = "";
      root.style.backgroundSize = "";
      root.style.backgroundPosition = "";
      root.style.backgroundAttachment = "";
      root.style.backgroundRepeat = "";
    }
  }, [backgroundUrl]);

  const upsertSettings = async (patch: Record<string, any>) => {
    if (!ownerId) return;
    await supabase.from("studio_settings").upsert({
      owner_id: ownerId,
      ...patch,
      updated_at: new Date().toISOString(),
    } as any);
  };

  const updateName = async (name: string) => {
    if (!isOwner) return;
    const trimmed = name.trim().slice(0, 60) || "TRINETRA";
    await upsertSettings({ studio_name: trimmed });
    setStudioName(trimmed);
  };

  const uploadLogo = async (file: File) => {
    if (!ownerId || !isOwner || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("studio-logos").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("studio-logos").getPublicUrl(path);
    await upsertSettings({ logo_url: pub.publicUrl });
    setLogoUrl(pub.publicUrl);
  };

  const uploadBackground = async (file: File) => {
    if (!ownerId || !isOwner || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/bg-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("studio-backgrounds").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("studio-backgrounds").getPublicUrl(path);
    await upsertSettings({ background_url: pub.publicUrl });
    setBackgroundUrl(pub.publicUrl);
  };

  const setBackgroundFromUrl = async (url: string) => {
    if (!isOwner) return;
    await upsertSettings({ background_url: url });
    setBackgroundUrl(url);
  };

  const removeBackground = async () => {
    if (!isOwner) return;
    await upsertSettings({ background_url: null });
    setBackgroundUrl(null);
  };

  const upsertSecurity = async (patch: Record<string, any>) => {
    if (!ownerId) return;
    await supabase.from("studio_security" as any).upsert({
      owner_id: ownerId,
      ...patch,
      updated_at: new Date().toISOString(),
    } as any);
  };

  const setPaymentsPin = async (pin: string | null) => {
    if (!isOwner) return;
    const hash = pin ? await sha256Hex(pin) : null;
    await upsertSecurity({ payments_pin_hash: hash });
    setPaymentsPinHash(hash);
  };
  const verifyPaymentsPin = async (pin: string) => {
    if (!paymentsPinHash) return false;
    return (await sha256Hex(pin)) === paymentsPinHash;
  };

  const setAppLockPin = async (pin: string | null) => {
    if (!isOwner) return;
    const hash = pin ? await sha256Hex(pin) : null;
    await upsertSecurity({ app_lock_pin_hash: hash });
    setAppLockPinHash(hash);
  };

  const verifyAppLockPin = async (pin: string) => {
    if (!appLockPinHash) return true;
    return (await sha256Hex(pin)) === appLockPinHash;
  };

  return (
    <StudioContext.Provider value={{
      studioName, logoUrl, backgroundUrl,
      paymentsPinSet: !!paymentsPinHash,
      appLockPinSet: !!appLockPinHash,
      ownerId, isOwner, loading, refresh,
      updateName, uploadLogo, uploadBackground, setBackgroundFromUrl, removeBackground,
      setPaymentsPin, verifyPaymentsPin,
      setAppLockPin, verifyAppLockPin,
    }}>
      {children}
    </StudioContext.Provider>
  );
};

export const useStudio = () => {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
};
