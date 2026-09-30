/** Server-side recognition boundary. Face vectors and provider credentials never enter the browser. */
import { supabase } from "@/integrations/supabase/client";

export type RecognitionResult = {
  recognizedIds: string[];
  unknownFaces: number;
  matches?: { memberId: string; similarity: number }[];
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
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.access_token) throw new Error("Sign in to use face recognition");
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/photo-recognition`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Face recognition unavailable. Review photos and mark members manually.");
  return data;
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
  await photoRequest(form);
}

export const photoRecognitionService: PhotoRecognitionService = {
  async recognize(request) {
    if (!request.photos.length) throw new Error("Add at least one photo");
    const form = new FormData();
    form.set("action", "recognize"); form.set("batchId", request.batchId); form.set("date", request.date);
    for (const file of request.photos) form.append("photos", await recognitionImage(file));
    const result = await photoRequest(form);
    return uniqueBatchMatches({
      matches: result.matches,
      recognizedIds: Array.isArray(result.matches) ? result.matches.map((m: { memberId: string }) => m.memberId) : [],
      unknownFaces: result.unknownFaces ?? 0,
    }, request.memberIds);
  },
};

export const uniqueBatchMatches = (result: RecognitionResult, memberIds: string[]): RecognitionResult => {
  const allowed = new Set(memberIds);
  return {
    recognizedIds: [...new Set(result.recognizedIds)].filter((id) => allowed.has(id)),
    unknownFaces: Math.max(0, Math.floor(result.unknownFaces)),
    ...(result.matches ? { matches: result.matches.filter((m) => allowed.has(m.memberId)) } : {}),
  };
};
