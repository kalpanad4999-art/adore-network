import type { MemberPayload } from "../types";
import { memberService } from "./memberService";

export interface MemberRecognition {
  prepare(photo: File): Promise<File>;
  enroll(id: string, batchId: string, path: string): Promise<void>;
}

/** Preserve the existing multi-step save and rollback order; this is not a transaction. */
export async function saveMemberWithPhoto(
  payload: MemberPayload, id: string | null, photo: File | null,
  recognition: MemberRecognition, service = memberService,
): Promise<void> {
  const saved = await service.save(payload, id);
  if (!photo) return;
  const prepared = await recognition.prepare(photo);
  const path = `${payload.user_id}/${saved.id}/${crypto.randomUUID()}.${prepared.type === "image/png" ? "png" : "jpg"}`;
  try { await service.uploadPhoto(path, prepared); }
  catch (error) { console.error("[face-photo] Private storage upload failed", { memberId: saved.id, error }); throw error; }
  console.info("[face-photo] Private storage upload succeeded", { memberId: saved.id, bytes: prepared.size });
  try { await service.linkPhoto(saved.id, path); }
  catch (error) {
    console.error("[face-photo] Member photo link failed", { memberId: saved.id, error });
    await service.removePhoto(path);
    throw error;
  }
  console.info("[face-photo] Member photo linked; requesting private face enrollment", { memberId: saved.id, batchId: payload.batch_id });
  try {
    await recognition.enroll(saved.id, payload.batch_id, path);
    console.info("[face-photo] Face enrolled against member", { memberId: saved.id });
  } catch (error) {
    console.error("[face-photo] Face enrollment failed; reverting new photo", { memberId: saved.id, error });
    await service.restorePhoto(saved.id, saved.photo_path);
    await service.removePhoto(path);
    throw error;
  }
  if (saved.photo_path) await service.removePhoto(saved.photo_path);
}

export async function deleteMember(id: string, service = memberService): Promise<void> {
  await service.deletePayments(id);
  await service.deleteRecord(id);
}