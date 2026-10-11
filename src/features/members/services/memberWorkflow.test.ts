import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./memberService", () => ({ memberService: {} }));
import { deleteMember, saveMemberWithPhoto } from "./memberWorkflow";
import type { memberService } from "./memberService";
import type { MemberPayload } from "../types";

const payload: MemberPayload = { user_id: "owner", batch_id: "batch", name: "Member", email: null, phone: null, address: null, notes: null, height_cm: null, weight_kg: null, custom_data: {} };
const photo = new File(["fixture"], "photo.png", { type: "image/png" });
let calls: string[];
function fixtures(oldPath: string | null = null) {
  const operation = (name: string) => vi.fn(async () => { calls.push(name); });
  const service = {
    save: vi.fn(async () => { calls.push("save"); return { id: "member", photo_path: oldPath }; }),
    uploadPhoto: operation("upload"), linkPhoto: operation("link"), restorePhoto: operation("restore"),
    removePhoto: operation("remove"), deletePayments: operation("payments"), deleteRecord: operation("delete"),
  };
  const recognition = { prepare: vi.fn(async (file: File) => { calls.push("prepare"); return file; }), enroll: operation("enroll") };
  // Only workflow operations are required by this fixture; no fake identity results.
  return { service, recognition, adapter: service as unknown as typeof memberService };
}
beforeEach(() => { calls = []; vi.restoreAllMocks(); vi.spyOn(console, "info").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });
describe("member save ordering", () => {
  it("saves without invoking photo operations when no photo is selected", async () => {
    const f = fixtures(); await saveMemberWithPhoto(payload, null, null, f.recognition, f.adapter);
    expect(calls).toEqual(["save"]); expect(f.service.save).toHaveBeenCalledWith(payload, null);
  });
  it("uploads, links and enrolls against the existing saved ID", async () => {
    const f = fixtures(); await saveMemberWithPhoto(payload, "member", photo, f.recognition, f.adapter);
    expect(calls).toEqual(["save", "prepare", "upload", "link", "enroll"]);
    const path = f.service.uploadPhoto.mock.calls[0]?.[0];
    expect(path).toMatch(/^owner\/member\/.+\.png$/);
    expect(f.service.linkPhoto).toHaveBeenCalledWith("member", path);
    expect(f.recognition.enroll).toHaveBeenCalledWith("member", "batch", path);
  });
  it("removes the old photo only after successful enrollment", async () => {
    const f = fixtures("old"); await saveMemberWithPhoto(payload, "member", photo, f.recognition, f.adapter);
    expect(calls).toEqual(["save", "prepare", "upload", "link", "enroll", "remove"]);
    expect(f.service.removePhoto).toHaveBeenCalledWith("old");
  });
  it("stops on member save failure", async () => {
    const f = fixtures(); f.service.save.mockRejectedValueOnce(new Error("save failed"));
    await expect(saveMemberWithPhoto(payload, null, photo, f.recognition, f.adapter)).rejects.toThrow("save failed");
    expect(f.recognition.prepare).not.toHaveBeenCalled();
  });
  it("stops on image preparation failure without uploading", async () => {
    const f = fixtures(); f.recognition.prepare.mockRejectedValueOnce(new Error("prepare failed"));
    await expect(saveMemberWithPhoto(payload, null, photo, f.recognition, f.adapter)).rejects.toThrow("prepare failed");
    expect(f.service.uploadPhoto).not.toHaveBeenCalled();
  });
  it("does not link or remove the old photo on upload failure", async () => {
    const f = fixtures("old"); f.service.uploadPhoto.mockRejectedValueOnce(new Error("upload failed"));
    await expect(saveMemberWithPhoto(payload, "member", photo, f.recognition, f.adapter)).rejects.toThrow("upload failed");
    expect(f.service.linkPhoto).not.toHaveBeenCalled(); expect(f.service.removePhoto).not.toHaveBeenCalled();
  });
  it("removes the new upload and skips enrollment on link failure", async () => {
    const f = fixtures("old"); f.service.linkPhoto.mockRejectedValueOnce(new Error("link failed"));
    await expect(saveMemberWithPhoto(payload, "member", photo, f.recognition, f.adapter)).rejects.toThrow("link failed");
    expect(f.service.removePhoto).toHaveBeenCalledWith(f.service.uploadPhoto.mock.calls[0]?.[0]);
    expect(f.recognition.enroll).not.toHaveBeenCalled(); expect(f.service.restorePhoto).not.toHaveBeenCalled();
  });
  it.each([null, "old"])("restores previous path %s before removing the new upload on enrollment failure", async (old) => {
    const f = fixtures(old); f.recognition.enroll.mockImplementationOnce(async () => { calls.push("enroll"); throw new Error("enroll failed"); });
    await expect(saveMemberWithPhoto(payload, "member", photo, f.recognition, f.adapter)).rejects.toThrow("enroll failed");
    expect(calls.slice(-3)).toEqual(["enroll", "restore", "remove"]);
    expect(f.service.restorePhoto).toHaveBeenCalledWith("member", old);
    expect(f.service.removePhoto).not.toHaveBeenCalledWith("old");
  });
});
describe("member deletion", () => {
  it("deletes payments before the member", async () => {
    const f = fixtures(); await deleteMember("member", f.adapter);
    expect(calls).toEqual(["payments", "delete"]);
    expect(f.service.deleteRecord).toHaveBeenCalledWith("member");
  });
  it("does not delete the member if payment deletion fails", async () => {
    const f = fixtures(); f.service.deletePayments.mockRejectedValueOnce(new Error("denied"));
    await expect(deleteMember("member", f.adapter)).rejects.toThrow("denied");
    expect(f.service.deleteRecord).not.toHaveBeenCalled();
  });
  it("propagates member deletion failure", async () => {
    const f = fixtures(); f.service.deleteRecord.mockRejectedValueOnce(new Error("denied"));
    await expect(deleteMember("member", f.adapter)).rejects.toThrow("denied");
  });
});