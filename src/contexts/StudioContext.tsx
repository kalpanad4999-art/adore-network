import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { registerBiometric, verifyBiometric } from "@/lib/biometric";
import { logAudit } from "@/lib/audit";

const sha256Hex = async (input: string) => {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export type ModuleKey = "customers" | "gallery" | "classes" | "payments" | "renewals";
export type ModulePermissions = Record<ModuleKey, boolean>;

const ALL_ALLOWED: ModulePermissions = {
  customers: true, gallery: true, classes: true, payments: true, renewals: true,
};

interface StudioContextValue {
  studioName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  paymentsPinSet: boolean;
  appLockPinSet: boolean;
  biometricEnabled: boolean;
  biometricCredentialId: string | null;
  ownerId: string | null;
  isOwner: boolean;
  permissions: ModulePermissions;
  loading: boolean;
  refresh: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  uploadBackground: (file: File) => Promise<void>;
  setBackgroundFromUrl: (url: string) => Promise<void>;
  removeBackground: () => Promise<void>;
  setPaymentsPassword: (pin: string | null, currentPassword?: string) => Promise<void>;
  verifyPaymentsPin: (pin: string) => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  verifyBiometricUnlock: () => Promise<boolean>;
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
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [permissions, setPermissions] = useState<ModulePermissions>(ALL_ALLOWED);
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
        .select("payments_pin_hash, app_lock_pin_hash, webauthn_credential_id, webauthn_enabled")
        .eq("owner_id", owner)
        .maybeSingle();
      const s = (sec ?? {}) as any;
      setPaymentsPinHash(s.payments_pin_hash ?? null);
      setAppLockPinHash(s.app_lock_pin_hash ?? null);
      setBiometricCredentialId(s.webauthn_credential_id ?? null);
      setBiometricEnabled(!!s.webauthn_enabled && !!s.webauthn_credential_id);
    } else {
      setPaymentsPinHash(null);
      setAppLockPinHash(null);
      setBiometricCredentialId(null);
      setBiometricEnabled(false);
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

  const setPaymentsPassword = async (pin: string | null, currentPassword?: string) => {
    if (!isOwner) return;
    // If a password is already set and we're changing it, require current password
    if (paymentsPinHash && pin) {
      if (!currentPassword) throw new Error("Current password is required");
      const currentHash = await sha256Hex(currentPassword);
      if (currentHash !== paymentsPinHash) throw new Error("Current password is incorrect");
    }
    // Removing requires current password as well
    if (paymentsPinHash && pin === null) {
      if (!currentPassword) throw new Error("Current password is required to disable Payment Lock");
      const currentHash = await sha256Hex(currentPassword);
      if (currentHash !== paymentsPinHash) throw new Error("Current password is incorrect");
    }
    const hash = pin ? await sha256Hex(pin) : null;
    const patch: Record<string, any> = { payments_pin_hash: hash };
    // If lock is being disabled, also disable biometric
    if (!hash) {
      patch.webauthn_enabled = false;
      patch.webauthn_credential_id = null;
    }
    await upsertSecurity(patch);
    setPaymentsPinHash(hash);
    if (!hash) { setBiometricEnabled(false); setBiometricCredentialId(null); }
    await logAudit(ownerId, pin ? (paymentsPinHash ? "payment_lock.password_changed" : "payment_lock.enabled") : "payment_lock.disabled");
  };
  const verifyPaymentsPin = async (pin: string) => {
    if (!paymentsPinHash) return false;
    const ok = (await sha256Hex(pin)) === paymentsPinHash;
    await logAudit(ownerId, ok ? "payment_lock.unlock_password_success" : "payment_lock.unlock_password_failed");
    return ok;
  };

  const enableBiometric = async () => {
    if (!isOwner || !user) return;
    if (!paymentsPinHash) throw new Error("Set a Payment Lock password first");
    const credentialId = await registerBiometric(user.id, user.email || "owner");
    await upsertSecurity({ webauthn_credential_id: credentialId, webauthn_enabled: true });
    setBiometricCredentialId(credentialId);
    setBiometricEnabled(true);
    await logAudit(ownerId, "payment_lock.biometric_enabled");
  };

  const disableBiometric = async () => {
    if (!isOwner) return;
    await upsertSecurity({ webauthn_enabled: false, webauthn_credential_id: null });
    setBiometricCredentialId(null);
    setBiometricEnabled(false);
    await logAudit(ownerId, "payment_lock.biometric_disabled");
  };

  const verifyBiometricUnlock = async () => {
    if (!biometricEnabled || !biometricCredentialId) return false;
    const ok = await verifyBiometric(biometricCredentialId);
    await logAudit(ownerId, ok ? "payment_lock.unlock_biometric_success" : "payment_lock.unlock_biometric_failed");
    return ok;
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
      biometricEnabled, biometricCredentialId,
      ownerId, isOwner, loading, refresh,
      updateName, uploadLogo, uploadBackground, setBackgroundFromUrl, removeBackground,
      setPaymentsPassword, verifyPaymentsPin,
      enableBiometric, disableBiometric, verifyBiometricUnlock,
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
