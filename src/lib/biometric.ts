// Local-device biometric (WebAuthn platform authenticator) helpers.
// We use WebAuthn as a "device unlock" — the browser handles the biometric
// prompt and only returns success if the user authenticates. We trust that
// local check (this is unlocking a local UI, not authenticating against a
// remote server), so we don't verify the assertion signature server-side.

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (s: string): Uint8Array => {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const biometricSupported = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await (window.PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false;
  } catch { return false; }
};

export const registerBiometric = async (userId: string, label: string): Promise<string> => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Trinetra Yoga", id: window.location.hostname },
      user: { id: userIdBytes, name: label, displayName: label },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Registration cancelled");
  return b64url(cred.rawId);
};

export const verifyBiometric = async (credentialId: string): Promise<boolean> => {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: fromB64url(credentialId).buffer as ArrayBuffer, type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
        rpId: window.location.hostname,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
};
