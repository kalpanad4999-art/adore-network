/** In-browser face recognition (face-api). Photos never leave the device for recognition; only 128-number descriptors are stored. */
import * as faceapi from "@vladmandic/face-api";
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

/** Euclidean distance above this is never treated as a match (~ below 50% similarity). */
export const MATCH_DISTANCE_THRESHOLD = 0.5;
const MODEL_URL = "/models";

let modelsPromise: Promise<void> | null = null;
export function loadFaceModels(): Promise<void> {
  modelsPromise ??= (async () => {
    console.info("[face-recognition] Loading models from", MODEL_URL);
    await faceapi.tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    console.info("[face-recognition] Detector loaded");
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.info("[face-recognition] Landmarks loaded");
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.info("[face-recognition] Recognition model loaded; backend", faceapi.tf.getBackend());
  })().catch((error) => {
    console.error("[face-recognition] Model loading failed", error);
    modelsPromise = null;
    throw new Error("Face recognition models could not load. Check your connection and try again.");
  });
  return modelsPromise;
}

const detectorOptions = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

async function faceDescriptors(blob: Blob) {
  await loadFaceModels();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    return await faceapi.detectAllFaces(canvas, detectorOptions()).withFaceLandmarks().withFaceDescriptors();
  } finally { bitmap.close(); }
}

/** Normalize WebP to JPEG on device. */
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

/** Generates the member's descriptor from their saved reference photo and stores it against the member ID. */
export async function enrollMemberFace(memberId: string, batchId: string, photoPath: string): Promise<void> {
  console.info("[face-recognition] Enrolling member", { memberId });
  const { data: member, error: memberError } = await supabase.from("students").select("user_id").eq("id", memberId).single();
  if (memberError || !member) { console.error("[face-recognition] Member lookup failed", memberError); throw new Error("Member not found for face profile"); }
  const { data: photo, error: downloadError } = await supabase.storage.from("member-photos").download(photoPath);
  if (downloadError || !photo) { console.error("[face-recognition] Photo download failed", downloadError); throw new Error("Saved photo could not be read for the face profile"); }
  const faces = await faceDescriptors(photo);
  console.info("[face-recognition] Faces in reference photo", faces.length);
  if (faces.length === 0) throw new Error("No clear face detected. Please retake or choose another photo.");
  if (faces.length > 1) throw new Error("Multiple faces detected. Use a photo of only this member.");
  if (faces[0].detection.score < 0.8) throw new Error("Face is not clear enough. Use a brighter, front-facing photo.");
  const { error } = await supabase.from("member_face_enrollments").upsert({
    student_id: memberId, owner_id: member.user_id, batch_id: batchId, photo_path: photoPath,
    descriptor: Array.from(faces[0].descriptor), provider_face_id: null,
  } as never, { onConflict: "student_id" });
  if (error) { console.error("[face-recognition] Descriptor save failed", error); throw new Error("Face profile could not be saved"); }
  console.info("[face-recognition] Descriptor saved", { memberId });
}

export const photoRecognitionService: PhotoRecognitionService = {
  async recognize(request) {
    if (!request.photos.length) throw new Error("Add at least one photo");
    const { data, error } = await supabase.from("member_face_enrollments").select("student_id, descriptor").in("student_id", request.memberIds);
    if (error) { console.error("[face-recognition] Descriptor load failed", error); throw new Error("Member face profiles could not be loaded"); }
    const known = ((data ?? []) as { student_id: string; descriptor: number[] | null }[])
      .filter((r) => Array.isArray(r.descriptor) && r.descriptor.length === 128)
      .map((r) => ({ id: r.student_id, d: new Float32Array(r.descriptor!) }));
    console.info("[face-recognition] Registered descriptors in batch", known.length);

    const faces: Float32Array[] = [];
    for (const photo of request.photos) {
      const found = await faceDescriptors(photo);
      console.info("[face-recognition] Faces detected in photo", { name: photo.name, count: found.length });
      faces.push(...found.map((f) => f.descriptor));
    }

    // Greedy one-to-one assignment: closest face/member pairs first, each used once.
    const pairs: { f: number; id: string; dist: number }[] = [];
    faces.forEach((fd, f) => known.forEach((k) => {
      const dist = faceapi.euclideanDistance(fd, k.d);
      if (dist <= MATCH_DISTANCE_THRESHOLD) pairs.push({ f, id: k.id, dist });
    }));
    pairs.sort((a, b) => a.dist - b.dist);
    const usedFaces = new Set<number>(); const matched = new Map<string, number>();
    for (const p of pairs) {
      if (usedFaces.has(p.f) || matched.has(p.id)) continue;
      usedFaces.add(p.f); matched.set(p.id, Math.round((1 - p.dist) * 100));
    }
    const matches = [...matched].map(([memberId, similarity]) => ({ memberId, similarity }));
    return uniqueBatchMatches({
      available: true, matches, recognizedIds: matches.map((m) => m.memberId), unknownFaces: faces.length - usedFaces.size,
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
