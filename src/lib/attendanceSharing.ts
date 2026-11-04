export type SharingMember = { id: string; name: string; batch_id: string | null; phone: string | null };
export type SharingAttendance = { student_id: string; batch_id: string; attendance_date: string; status: string };
export type SharingRecording = {
  id: string; title: string; public_slug: string | null; is_public: boolean;
  archived_at: string | null; publish_at: string | null; expires_at: string | null;
  storage_path: string | null; external_url: string | null;
};

export function recordingRecipients(members: SharingMember[], records: SharingAttendance[], batchId: string, date: string, audience: "absent" | "everyone") {
  const absent = new Set(records.filter((r) => r.batch_id === batchId && r.attendance_date === date && r.status === "absent").map((r) => r.student_id));
  return members.filter((m) => m.batch_id === batchId && (audience === "everyone" || absent.has(m.id)));
}

export function registeredWhatsAppNumber(phone: string | null): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `91${digits}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function recordingShareUrl(recording: SharingRecording, origin: string, now = Date.now()): string | null {
  if (!recording.is_public || recording.archived_at || !recording.public_slug || (!recording.storage_path && !recording.external_url)) return null;
  if (recording.publish_at && !(Date.parse(recording.publish_at) <= now)) return null;
  if (recording.expires_at && !(Date.parse(recording.expires_at) > now)) return null;
  return `${origin}/r/${encodeURIComponent(recording.public_slug)}`;
}