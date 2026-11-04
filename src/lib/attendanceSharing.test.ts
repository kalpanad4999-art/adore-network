import { describe, expect, it } from "vitest";
import { recordingRecipients, recordingShareUrl, registeredWhatsAppNumber, type SharingRecording } from "./attendanceSharing";

const members = [
  { id: "absent", name: "A", batch_id: "batch", phone: "9876543210" },
  { id: "present", name: "P", batch_id: "batch", phone: "+919876543211" },
  { id: "unmarked", name: "U", batch_id: "batch", phone: null },
  { id: "other", name: "O", batch_id: "other", phone: "9876543212" },
];
const records = [
  { student_id: "absent", batch_id: "batch", attendance_date: "2026-11-04", status: "absent" },
  { student_id: "present", batch_id: "batch", attendance_date: "2026-11-04", status: "present" },
  { student_id: "unmarked", batch_id: "batch", attendance_date: "2026-11-03", status: "absent" },
  { student_id: "other", batch_id: "other", attendance_date: "2026-11-04", status: "absent" },
];
const recording: SharingRecording = { id: "r", title: "Morning Yoga", is_public: true, public_slug: "morning", archived_at: null, publish_at: null, expires_at: null, storage_path: "owner/class.mp4", external_url: null };

describe("Attendance recording sharing", () => {
  it("targets only explicitly Absent members in the selected batch and date", () => {
    expect(recordingRecipients(members, records, "batch", "2026-11-04", "absent").map((m) => m.id)).toEqual(["absent"]);
  });
  it("everyone includes Present, Absent and unmarked members but no other batch", () => {
    expect(recordingRecipients(members, records, "batch", "2026-11-04", "everyone").map((m) => m.id)).toEqual(["absent", "present", "unmarked"]);
  });
  it("does not mutate attendance statuses", () => {
    const before = structuredClone(records);
    recordingRecipients(members, records, "batch", "2026-11-04", "absent");
    expect(records).toEqual(before);
  });
  it("uses registered numbers with the existing India default", () => {
    expect(registeredWhatsAppNumber("98765 43210")).toBe("919876543210");
    expect(registeredWhatsAppNumber("+44 7700 900123")).toBe("447700900123");
    expect(registeredWhatsAppNumber("0044 7700 900123")).toBe("447700900123");
    expect(registeredWhatsAppNumber(null)).toBeNull();
    expect(registeredWhatsAppNumber("123")).toBeNull();
  });
  it("shares the existing permanent recording page, not a temporary storage URL", () => {
    expect(recordingShareUrl(recording, "https://studio.example")).toBe("https://studio.example/r/morning");
  });
  it("never shares private, archived, unpublished, expired or missing recordings", () => {
    const now = Date.parse("2026-11-04T07:42:00Z");
    for (const patch of [{ is_public: false }, { archived_at: "2026-11-03" }, { public_slug: null }, { publish_at: "2026-11-05" }, { expires_at: "2026-11-04" }, { storage_path: null }]) {
      expect(recordingShareUrl({ ...recording, ...patch }, "https://studio.example", now)).toBeNull();
    }
  });
});