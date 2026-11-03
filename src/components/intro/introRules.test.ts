import { describe, expect, it } from "vitest";
import { introDuration, shouldShowIntro } from "./introRules";

describe("opening intro", () => {
  it("plays for 4.5 seconds", () => {
    expect(introDuration(false)).toBe(4500);
  });
  it("skips automatic movement for reduced motion", () => {
    expect(introDuration(true)).toBe(0);
  });
  it("does not cover authentication callbacks or recovery", () => {
    expect(shouldShowIntro("/auth/callback")).toBe(false);
    expect(shouldShowIntro("/reset-password")).toBe(false);
    expect(shouldShowIntro("/accept-invite/token")).toBe(false);
    expect(shouldShowIntro("/")).toBe(true);
    expect(shouldShowIntro("/auth")).toBe(true);
  });
});