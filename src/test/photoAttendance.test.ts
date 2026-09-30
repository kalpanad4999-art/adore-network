import { describe, expect, it } from "vitest";
import { uniqueBatchMatches } from "@/lib/photoAttendance";

describe("photo attendance", () => {
  it("keeps only unique matches in the selected batch", () => {
    expect(uniqueBatchMatches({ recognizedIds: ["a", "a", "b", "outside"], unknownFaces: 2 }, ["a", "b"]))
      .toEqual({ recognizedIds: ["a", "b"], unknownFaces: 2 });
  });

  it("never exposes a match outside the selected batch", () => {
    expect(uniqueBatchMatches({ recognizedIds: ["a", "outside"], unknownFaces: 1, matches: [{ memberId: "a", similarity: 98 }, { memberId: "outside", similarity: 97 }] }, ["a"]))
      .toEqual({ recognizedIds: ["a"], unknownFaces: 1, matches: [{ memberId: "a", similarity: 98 }] });
  });
});