import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage, readFunctionError } from "./authErrors";

afterEach(() => vi.unstubAllGlobals());

describe("authentication error messages", () => {
  it("distinguishes invalid credentials from connectivity failures", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe("The email or password is incorrect.");
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toContain("sign-in service cannot be reached");
  });

  it("reports an offline browser accurately", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toContain("offline");
  });

  it("uses the phone API response when available", async () => {
    const context = new Response(JSON.stringify({ error: "Phone sign-in is temporarily disabled." }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
    await expect(readFunctionError({ context, message: "Edge Function returned a non-2xx status code" }))
      .resolves.toBe("Phone sign-in is temporarily disabled.");
  });
});