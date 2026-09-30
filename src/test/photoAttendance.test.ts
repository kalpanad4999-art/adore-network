import { describe, expect, it } from "vitest";
import { photoRecognitionService, uniqueBatchMatches } from "@/lib/photoAttendance";

describe("photo attendance", () => {
  it("keeps only unique matches in the selected batch", () => {
    expect(uniqueBatchMatches({ recognizedIds: ["a", "a", "b", "outside"], unknownFaces: 2 }, ["a", "b"]))
      .toEqual({ recognizedIds: ["a", "b"], unknownFaces: 2 });
  });

  it("never invents a match when no recognition provider is available", async () => {
    await expect(photoRecognitionService.recognize({ batchId: "b", date: "2026-09-30", photos: [], memberIds: ["a"] }))
      .rejects.toThrow("not connected");
  });
});