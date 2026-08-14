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

export type ModuleKey =
  | "customers" | "gallery" | "classes" | "payments" | "renewals"
  | "attendance" | "insights" | "offers" | "settings";
export type ModulePermissions = Record<ModuleKey, boolean>;

const ALL_ALLOWED: ModulePermissions = {
  customers: true, gallery: true, classes: true, payments: true, renewals: true,
  attendance: true, insights: true, offers: true, settings: true,
};

interface StudioContextValue {
  studioName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  paymentsPinSet: boolean;
  appLockPinSet: boolean;
  termsEnabled: boolean;
  termsImageUrl: string | null;
  biometricEnabled: boolean;
  biometricCredentialId: string | null;
  ownerId: string | null;
  isOwner: boolean;
  role: "owner" | "staff" | null;
  authorized: boolean;
  permissions: ModulePermissions;
  loading: boolean;
  refresh: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
  uploadBackground: (file: File) => Promise<void>;
  setBackgroundFromUrl: (url: string) => Promise<void>;
  removeBackground: () => Promise<void>;
  setPaymentsPassword: (pin: string | null, currentPassword?: string) => Promise<void>;
  resetPaymentsPasswordWithAccount: (accountPassword: string, newPin: string | null) => Promise<void>;
  verifyPaymentsPin: (pin: string) => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  verifyBiometricUnlock: () => Promise<boolean>;
  setAppLockPin: (pin: string | null) => Promise<void>;
  verifyAppLockPin: (pin: string) => Promise<boolean>;
  uploadTermsImage: (file: File) => Promise<void>;
  removeTermsImage: () => Promise<void>;
  setTermsEnabled: (enabled: boolean) => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export const StudioProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [studioName, setStudioName] = useState("TRINETRA YOGA");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [paymentsPinHash, setPaymentsPinHash] = useState<string | null>(null);
  const [appLockPinHash, setAppLockPinHash] = useState<string | null>(null);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [termsEnabled, setTermsEnabled] = useState(false);
  const [termsImageUrl, setTermsImageUrl] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [role, setRole] = useState<"owner" | "staff" | null>(null);
  const [permissions, setPermissions] = useState<ModulePermissions>(ALL_ALLOWED);
  const [loading, setLoading] = useState(true);

  const NO_ACCESS: ModulePermissions = {
    customers: false, gallery: false, classes: false, payments: false, renewals: false,
    attendance: false, insights: false, offers: false, settings: false,
  };

  const refresh = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("owner_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    const nextRole = (roleRow?.role as "owner" | "staff" | undefined) ?? null;
    setRole(nextRole);
    const owner = roleRow?.owner_id || (nextRole === "owner" ? user.id : null);
    setOwnerId(owner);
    const isOwnerRole = nextRole === "owner";
    setIsOwner(isOwnerRole);
    if (isOwnerRole) {
      setPermissions(ALL_ALLOWED);
    } else if (!nextRole) {
      setPermissions(NO_ACCESS);
    } else {
      const { data: perm } = await supabase
        .from("staff_permissions" as any)
        .select("can_customers,can_gallery,can_classes,can_payments,can_renewals,is_active")
        .eq("staff_user_id", user.id)
        .maybeSingle();
      const p = (perm ?? null) as any;
      if (!p || !p.is_active) {
        setPermissions(NO_ACCESS);
      } else {
        setPermissions({
          customers: !!p.can_customers, gallery: !!p.can_gallery, classes: !!p.can_classes,
          payments: !!p.can_payments, renewals: !!p.can_renewals,
          attendance: !!p.can_customers || !!p.can_classes,
        });
      }
    }
    if (!owner) { setLoading(false); return; }

    const { data: settings } = await supabase
      .from("studio_settings")
      .select("*")
      .eq("owner_id", owner)
      .maybeSingle();
    if (settings) {
      const s = settings as any;
      setStudioName(s.studio_name || "TRINETRA YOGA");
      setLogoUrl(s.logo_url);
      setBackgroundUrl(s.background_url ?? null);
      setTermsEnabled(!!s.terms_enabled);
      setTermsImageUrl(s.terms_image_url ?? null);
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

  // Re-refresh role & module permissions the moment they change in the database
  // (ownership transfer, or the Owner toggling a Staff module), so changes apply
  // to this session immediately without a manual reload.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`studio-ctx-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` }, () => { refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_permissions", filter: `staff_user_id=eq.${user.id}` }, () => { refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

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

  // Keep the browser tab title & favicon in sync with the studio branding
  // so it matches across dashboard, sidebar, header, and browser tab.
  useEffect(() => {
    if (studioName) document.title = `${studioName} — Studio Management`;
    if (!logoUrl) return;
    const head = document.head;
    head.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach((el) => el.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = logoUrl;
    head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = logoUrl;
    head.appendChild(apple);
  }, [studioName, logoUrl]);


  const upsertSettings = async (patch: Record<string, any>) => {
    if (!ownerId) throw new Error("Studio not loaded yet");
    const { error } = await supabase.from("studio_settings").upsert({
      owner_id: ownerId,
      ...patch,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw error;
  };

  const updateName = async (name: string) => {
    if (!isOwner) return;
    const trimmed = name.trim().slice(0, 60) || "TRINETRA YOGA";
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
  const resetPaymentsPasswordWithAccount = async (accountPassword: string, newPin: string | null) => {
    if (!isOwner) throw new Error("Only the Owner can reset the Payment Lock");
    if (!user?.email) throw new Error("No signed-in account found");
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: accountPassword,
    });
    if (error) throw new Error("Incorrect account password");
    const hash = newPin ? await sha256Hex(newPin) : null;
    const patch: Record<string, any> = { payments_pin_hash: hash };
    if (!hash) {
      patch.webauthn_enabled = false;
      patch.webauthn_credential_id = null;
    }
    await upsertSecurity(patch);
    setPaymentsPinHash(hash);
    if (!hash) { setBiometricEnabled(false); setBiometricCredentialId(null); }
    await logAudit(ownerId, newPin ? "payment_lock.password_reset_via_account" : "payment_lock.disabled_via_account");
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

  const termsPathFromUrl = (url: string | null) => {
    if (!url) return null;
    const marker = "/studio-logos/";
    const i = url.indexOf(marker);
    return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  };

  const uploadTermsImage = async (file: File) => {
    if (!ownerId || !isOwner || !user) throw new Error("Only the Owner can update Terms & Conditions");
    if (file.type !== "image/png" && file.type !== "image/jpeg") throw new Error("Only PNG or JPG images are allowed");
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${user.id}/terms-${Date.now()}.${ext}`;
    const oldPath = termsPathFromUrl(termsImageUrl);
    const { error: upErr } = await supabase.storage.from("studio-logos").upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from("studio-logos").getPublicUrl(path);
    try {
      await upsertSettings({ terms_image_url: pub.publicUrl });
    } catch (e) {
      // Don't leave an orphaned file behind if the reference can't be saved.
      await supabase.storage.from("studio-logos").remove([path]).catch(() => {});
      throw e;
    }
    setTermsImageUrl(pub.publicUrl);
    // Best-effort cleanup of the replaced image.
    if (oldPath && oldPath !== path) {
      supabase.storage.from("studio-logos").remove([oldPath]).catch(() => {});
    }
  };

  const removeTermsImage = async () => {
    if (!isOwner) return;
    const oldPath = termsPathFromUrl(termsImageUrl);
    await upsertSettings({ terms_image_url: null, terms_enabled: false });
    setTermsImageUrl(null);
    setTermsEnabled(false);
    if (oldPath) supabase.storage.from("studio-logos").remove([oldPath]).catch(() => {});
  };

  const setTermsEnabledFn = async (enabled: boolean) => {
    if (!isOwner) return;
    await upsertSettings({ terms_enabled: enabled });
    setTermsEnabled(enabled);
  };

  return (
    <StudioContext.Provider value={{
      studioName, logoUrl, backgroundUrl,
      paymentsPinSet: !!paymentsPinHash,
      appLockPinSet: !!appLockPinHash,
      termsEnabled, termsImageUrl,
      biometricEnabled, biometricCredentialId,
      ownerId, isOwner, role, authorized: role !== null, permissions, loading, refresh,
      updateName, uploadLogo, uploadBackground, setBackgroundFromUrl, removeBackground,
      setPaymentsPassword, resetPaymentsPasswordWithAccount, verifyPaymentsPin,
      enableBiometric, disableBiometric, verifyBiometricUnlock,
      setAppLockPin, verifyAppLockPin,
      uploadTermsImage, removeTermsImage, setTermsEnabled: setTermsEnabledFn,
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
