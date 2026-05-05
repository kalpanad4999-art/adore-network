// End-to-end client-side encryption helpers.
// We derive an AES-GCM key from the user's App Lock PIN (or a fallback secret)
// using PBKDF2, and store it in sessionStorage as a JWK after unlock.

const SESSION_KEY = "trinetra-e2e-key";
const SALT_KEY = "trinetra-e2e-salt";

const subtle = () => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto unavailable");
  }
  return crypto.subtle;
};

const toB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const sha256Hex = async (input: string) => {
  const enc = new TextEncoder().encode(input);
  const buf = await subtle().digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const getOrCreateSalt = (ownerId: string) => {
  const existing = localStorage.getItem(`${SALT_KEY}-${ownerId}`);
  if (existing) return fromB64(existing);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(`${SALT_KEY}-${ownerId}`, toB64(salt.buffer));
  return salt;
};

export const deriveKeyFromSecret = async (secret: string, ownerId: string) => {
  const salt = getOrCreateSalt(ownerId);
  const baseKey = await subtle().importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
};

export const cacheKey = async (key: CryptoKey) => {
  const jwk = await subtle().exportKey("jwk", key);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(jwk));
};

export const getCachedKey = async (): Promise<CryptoKey | null> => {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return await subtle().importKey(
      "jwk",
      JSON.parse(raw),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
};

export const clearCachedKey = () => sessionStorage.removeItem(SESSION_KEY);

export const encryptString = async (plaintext: string, key?: CryptoKey | null) => {
  const k = key ?? (await getCachedKey());
  if (!k) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv },
    k,
    new TextEncoder().encode(plaintext),
  );
  return `v1:${toB64(iv.buffer)}:${toB64(ct)}`;
};

export const decryptString = async (
  payload: string | null | undefined,
  key?: CryptoKey | null,
): Promise<string | null> => {
  if (!payload || !payload.startsWith("v1:")) return null;
  const k = key ?? (await getCachedKey());
  if (!k) return null;
  try {
    const [, ivB64, ctB64] = payload.split(":");
    const pt = await subtle().decrypt(
      { name: "AES-GCM", iv: fromB64(ivB64) },
      k,
      fromB64(ctB64),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
};
