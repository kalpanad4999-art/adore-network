import { describe, expect, it } from "vitest";
import { INTRO_FADE_MS, introDuration, shouldShowIntro } from "./introRules";

describe("opening intro", () => {
  it("completes including the fade after 4 seconds", () => {
    expect(introDuration(false)).toBe(4000);
    const fadeStartsAt = introDuration(false) - INTRO_FADE_MS;
    expect(fadeStartsAt).toBe(3550);
    expect(fadeStartsAt + INTRO_FADE_MS).toBe(4000);
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