import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

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

const hashPin = async (pin: string) => {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

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
      .select("studio_name, logo_url, background_url, payments_pin_hash, app_lock_pin_hash")
      .eq("owner_id", owner)
      .maybeSingle();
    if (settings) {
      setStudioName(settings.studio_name || "TRINETRA");
      setLogoUrl(settings.logo_url);
      setBackgroundUrl((settings as any).background_url ?? null);
      setPaymentsPinHash((settings as any).payments_pin_hash ?? null);
      setAppLockPinHash((settings as any).app_lock_pin_hash ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user]);

  // Apply background image to body
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

  const updateName = async (name: string) => {
    if (!ownerId || !isOwner) return;
    const trimmed = name.trim().slice(0, 60) || "TRINETRA";
    const { error } = await supabase
      .from("studio_settings")
      .upsert({ owner_id: ownerId, studio_name: trimmed, updated_at: new Date().toISOString() });
    if (!error) setStudioName(trimmed);
  };

  const uploadLogo = async (file: File) => {
    if (!ownerId || !isOwner || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("studio-logos").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("studio-logos").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("studio_settings").upsert({ owner_id: ownerId, logo_url: url, updated_at: new Date().toISOString() });
    setLogoUrl(url);
  };

  const uploadBackground = async (file: File) => {
    if (!ownerId || !isOwner || !user) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/bg-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("studio-backgrounds").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("studio-backgrounds").getPublicUrl(path);
    const url = pub.publicUrl;
    await supabase.from("studio_settings").upsert({ owner_id: ownerId, background_url: url, updated_at: new Date().toISOString() });
    setBackgroundUrl(url);
  };

  const setBackgroundFromUrl = async (url: string) => {
    if (!ownerId || !isOwner) return;
    await supabase.from("studio_settings").upsert({ owner_id: ownerId, background_url: url, updated_at: new Date().toISOString() });
    setBackgroundUrl(url);
  };

  const removeBackground = async () => {
    if (!ownerId || !isOwner) return;
    await supabase.from("studio_settings").upsert({ owner_id: ownerId, background_url: null, updated_at: new Date().toISOString() });
    setBackgroundUrl(null);
  };

  const setPaymentsPin = async (pin: string | null) => {
    if (!ownerId || !isOwner) return;
    const hash = pin ? await hashPin(pin) : null;
    await supabase.from("studio_settings").upsert({ owner_id: ownerId, payments_pin_hash: hash, updated_at: new Date().toISOString() });
    setPaymentsPinHash(hash);
  };

  const verifyPaymentsPin = async (pin: string) => {
    if (!paymentsPinHash) return true;
    const hash = await hashPin(pin);
    return hash === paymentsPinHash;
  };

  return (
    <StudioContext.Provider value={{
      studioName, logoUrl, backgroundUrl,
      paymentsPinSet: !!paymentsPinHash,
      ownerId, isOwner, loading, refresh,
      updateName, uploadLogo, uploadBackground, setBackgroundFromUrl, removeBackground,
      setPaymentsPin, verifyPaymentsPin,
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
