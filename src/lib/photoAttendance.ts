/** Server-side recognition boundary. Face vectors and provider credentials never enter the browser. */
import { supabase } from "@/integrations/supabase/client";

export type RecognitionResult = {
  recognizedIds: string[];
  unknownFaces: number;
  matches?: { memberId: string; similarity: number }[];
  available?: boolean;
  unavailableReason?: string;
};

export type RecognitionRequest = {
  batchId: string;
  date: string;
  photos: File[];
  memberIds: string[];
};

export interface PhotoRecognitionService {
  recognize(request: RecognitionRequest): Promise<RecognitionResult>;
}

async function photoRequest(form: FormData) {
  const action = form.get("action");
  console.info("[face-recognition] Starting", { action });
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) { console.error("[face-recognition] Session lookup failed", sessionError); throw sessionError; }
  if (!session.session?.access_token) throw new Error("Sign in to use face recognition");
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/photo-recognition`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: form,
    });
    const text = await response.text();
    let data: { error?: string; code?: string; available?: boolean; enrolled?: boolean; matches?: { memberId: string; similarity: number }[]; unknownFaces?: number };
    try { data = JSON.parse(text); }
    catch (parseError) {
      console.error("[face-recognition] Invalid service response", { action, status: response.status, parseError, body: text.slice(0, 500) });
      throw new Error(`Face recognition returned an invalid response (HTTP ${response.status})`);
    }
    if (!response.ok || data.available === false) {
      console.error("[face-recognition] Service unavailable", { action, status: response.status, code: data.code, error: data.error });
    } else {
      console.info("[face-recognition] Service completed", { action, enrolled: data.enrolled, matchCount: data.matches?.length, unknownFaces: data.unknownFaces });
    }
    if (!response.ok) throw new Error(`[${data.code || response.status}] ${data.error || "Face recognition unavailable"}`);
    return data;
  } catch (error) {
    console.error("[face-recognition] Request failed", { action, error });
    throw error;
  }
}

/** Rekognition accepts JPEG/PNG; normalize WebP on device without identifying anyone. */
export async function recognitionImage(file: File): Promise<File> {
  if (file.type !== "image/webp") return file;
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("Could not prepare this photo");
    return new File([blob], file.name.replace(/\.webp$/i, ".jpg"), { type: "image/jpeg" });
  } finally { image.close(); }
}

export async function enrollMemberFace(memberId: string, batchId: string, photoPath: string): Promise<void> {
  const form = new FormData();
  form.set("action", "enroll"); form.set("memberId", memberId); form.set("batchId", batchId); form.set("photoPath", photoPath);
  const result = await photoRequest(form);
  if (result.available === false || result.enrolled !== true) {
    throw new Error(`[${result.code || "ENROLLMENT_FAILED"}] ${result.error || "The member photo was not enrolled."}`);
  }
}

export const photoRecognitionService: PhotoRecognitionService = {
  async recognize(request) {
    if (!request.photos.length) throw new Error("Add at least one photo");
    const form = new FormData();
    form.set("action", "recognize"); form.set("batchId", request.batchId); form.set("date", request.date);
    for (const file of request.photos) form.append("photos", await recognitionImage(file));
    const result = await photoRequest(form);
    if (result.available === false) {
      return {
        available: false,
        unavailableReason: `[${result.code || "UNAVAILABLE"}] ${result.error || "Face recognition unavailable. Review photos and mark members manually."}`,
        recognizedIds: [],
        unknownFaces: 0,
      };
    }
    return uniqueBatchMatches({
      available: true,
      matches: result.matches,
      recognizedIds: Array.isArray(result.matches) ? result.matches.map((m: { memberId: string }) => m.memberId) : [],
      unknownFaces: result.unknownFaces ?? 0,
    }, request.memberIds);
  },
};

export const uniqueBatchMatches = (result: RecognitionResult, memberIds: string[]): RecognitionResult => {
  const allowed = new Set(memberIds);
  return {
    ...(result.available !== undefined ? { available: result.available } : {}),
    ...(result.unavailableReason ? { unavailableReason: result.unavailableReason } : {}),
    recognizedIds: [...new Set(result.recognizedIds)].filter((id) => allowed.has(id)),
    unknownFaces: Math.max(0, Math.floor(result.unknownFaces)),
    ...(result.matches ? { matches: result.matches.filter((m) => allowed.has(m.memberId)) } : {}),
  };
};
