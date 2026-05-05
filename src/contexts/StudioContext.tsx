import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import {
  sha256Hex,
  deriveKeyFromSecret,
  cacheKey,
  clearCachedKey,
  getCachedKey,
} from "@/lib/crypto";

export type PaymentsLockMethod = "pin" | "password" | "question" | "biometric";

interface StudioContextValue {
  studioName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
  paymentsPinSet: boolean;
  paymentsPasswordSet: boolean;
  paymentsQuestionSet: boolean;
  paymentsBiometricSet: boolean;
  paymentsSecurityQuestion: string | null;
  paymentsBiometricCredentialId: string | null;
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
  // Payments locks
  setPaymentsPin: (pin: string | null) => Promise<void>;
  verifyPaymentsPin: (pin: string) => Promise<boolean>;
  setPaymentsPassword: (password: string | null) => Promise<void>;
  verifyPaymentsPassword: (password: string) => Promise<boolean>;
  setPaymentsSecurityQuestion: (question: string | null, answer: string | null) => Promise<void>;
  verifyPaymentsSecurityAnswer: (answer: string) => Promise<boolean>;
  registerPaymentsBiometric: () => Promise<boolean>;
  verifyPaymentsBiometric: () => Promise<boolean>;
  removePaymentsBiometric: () => Promise<void>;
  // App lock
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
  const [paymentsPasswordHash, setPaymentsPasswordHash] = useState<string | null>(null);
  const [paymentsQuestion, setPaymentsQuestion] = useState<string | null>(null);
  const [paymentsAnswerHash, setPaymentsAnswerHash] = useState<string | null>(null);
  const [paymentsBiometricCredId, setPaymentsBiometricCredId] = useState<string | null>(null);
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
      setPaymentsPinHash(s.payments_pin_hash ?? null);
      setAppLockPinHash(s.app_lock_pin_hash ?? null);
      setPaymentsPasswordHash(s.payments_password_hash ?? null);
      setPaymentsQuestion(s.payments_security_question ?? null);
      setPaymentsAnswerHash(s.payments_security_answer_hash ?? null);
      setPaymentsBiometricCredId(s.payments_biometric_credential_id ?? null);
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

  // Clear cached encryption key on sign-out
  useEffect(() => {
    if (!user) clearCachedKey();
  }, [user]);

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

  // ---------- Payments locks ----------
  const setPaymentsPin = async (pin: string | null) => {
    if (!isOwner) return;
    const hash = pin ? await sha256Hex(pin) : null;
    await upsertSettings({ payments_pin_hash: hash });
    setPaymentsPinHash(hash);
  };
  const verifyPaymentsPin = async (pin: string) => {
    if (!paymentsPinHash) return false;
    return (await sha256Hex(pin)) === paymentsPinHash;
  };

  const setPaymentsPassword = async (password: string | null) => {
    if (!isOwner) return;
    const hash = password ? await sha256Hex(`pwd:${password}`) : null;
    await upsertSettings({ payments_password_hash: hash });
    setPaymentsPasswordHash(hash);
  };
  const verifyPaymentsPassword = async (password: string) => {
    if (!paymentsPasswordHash) return false;
    return (await sha256Hex(`pwd:${password}`)) === paymentsPasswordHash;
  };

  const setPaymentsSecurityQuestion = async (question: string | null, answer: string | null) => {
    if (!isOwner) return;
    if (!question || !answer) {
      await upsertSettings({ payments_security_question: null, payments_security_answer_hash: null });
      setPaymentsQuestion(null); setPaymentsAnswerHash(null);
      return;
    }
    const hash = await sha256Hex(`ans:${answer.trim().toLowerCase()}`);
    await upsertSettings({ payments_security_question: question.trim(), payments_security_answer_hash: hash });
    setPaymentsQuestion(question.trim());
    setPaymentsAnswerHash(hash);
  };
  const verifyPaymentsSecurityAnswer = async (answer: string) => {
    if (!paymentsAnswerHash) return false;
    return (await sha256Hex(`ans:${answer.trim().toLowerCase()}`)) === paymentsAnswerHash;
  };

  const registerPaymentsBiometric = async () => {
    if (!isOwner || !ownerId) return false;
    if (typeof PublicKeyCredential === "undefined") return false;
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userIdBytes = new TextEncoder().encode(ownerId);
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "TRINETRA" },
          user: { id: userIdBytes, name: studioName, displayName: studioName },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          authenticatorSelection: { userVerification: "preferred" },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      const id = cred.id;
      await upsertSettings({ payments_biometric_credential_id: id });
      setPaymentsBiometricCredId(id);
      return true;
    } catch {
      return false;
    }
  };

  const verifyPaymentsBiometric = async () => {
    if (!paymentsBiometricCredId) return false;
    if (typeof PublicKeyCredential === "undefined") return false;
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const idBytes = Uint8Array.from(atob(
        paymentsBiometricCredId.replace(/-/g, "+").replace(/_/g, "/").padEnd(
          paymentsBiometricCredId.length + (4 - paymentsBiometricCredId.length % 4) % 4, "="
        )
      ), c => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: idBytes, type: "public-key" }],
          userVerification: "preferred",
          timeout: 60_000,
        },
      });
      return !!assertion;
    } catch {
      return false;
    }
  };

  const removePaymentsBiometric = async () => {
    if (!isOwner) return;
    await upsertSettings({ payments_biometric_credential_id: null });
    setPaymentsBiometricCredId(null);
  };

  // ---------- App lock + encryption key derivation ----------
  const setAppLockPin = async (pin: string | null) => {
    if (!ownerId || !isOwner) return;
    const hash = pin ? await sha256Hex(pin) : null;
    await upsertSettings({ app_lock_pin_hash: hash });
    setAppLockPinHash(hash);
    if (pin) {
      const key = await deriveKeyFromSecret(pin, ownerId);
      await cacheKey(key);
    } else {
      clearCachedKey();
    }
  };

  const verifyAppLockPin = async (pin: string) => {
    if (!appLockPinHash) return true;
    const ok = (await sha256Hex(pin)) === appLockPinHash;
    if (ok && ownerId) {
      const cached = await getCachedKey();
      if (!cached) {
        const key = await deriveKeyFromSecret(pin, ownerId);
        await cacheKey(key);
      }
    }
    return ok;
  };

  return (
    <StudioContext.Provider value={{
      studioName, logoUrl, backgroundUrl,
      paymentsPinSet: !!paymentsPinHash,
      paymentsPasswordSet: !!paymentsPasswordHash,
      paymentsQuestionSet: !!paymentsAnswerHash,
      paymentsBiometricSet: !!paymentsBiometricCredId,
      paymentsSecurityQuestion: paymentsQuestion,
      paymentsBiometricCredentialId: paymentsBiometricCredId,
      appLockPinSet: !!appLockPinHash,
      ownerId, isOwner, loading, refresh,
      updateName, uploadLogo, uploadBackground, setBackgroundFromUrl, removeBackground,
      setPaymentsPin, verifyPaymentsPin,
      setPaymentsPassword, verifyPaymentsPassword,
      setPaymentsSecurityQuestion, verifyPaymentsSecurityAnswer,
      registerPaymentsBiometric, verifyPaymentsBiometric, removePaymentsBiometric,
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
