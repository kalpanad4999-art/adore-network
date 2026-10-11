import { beforeEach, describe, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "order", "in", "insert", "update", "delete", "single"]) chain[method] = vi.fn(() => chain);
  return { chain, from: vi.fn(() => chain), result: { data: null, error: null } as { data: unknown; error: unknown }, storage: { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() }, channel: { on: vi.fn(), subscribe: vi.fn() }, removeChannel: vi.fn() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: sdk.from, storage: { from: vi.fn(() => sdk.storage) }, channel: vi.fn(() => sdk.channel), removeChannel: sdk.removeChannel } }));
import { memberService } from "./memberService";
beforeEach(() => {
  vi.clearAllMocks(); sdk.result = { data: null, error: null };
  Object.assign(sdk.chain, { then: (resolve: (value: unknown) => void) => resolve(sdk.result) });
  sdk.channel.on.mockReturnValue(sdk.channel); sdk.channel.subscribe.mockReturnValue(sdk.channel);
});
describe("member Cloud adapter", () => {
  it("scopes reads to the workspace and normalizes empty custom data", async () => {
    sdk.result.data = [{ id: "m", custom_data: null }];
    expect(await memberService.list("owner")).toEqual([{ id: "m", custom_data: {} }]);
    expect(sdk.chain.eq).toHaveBeenCalledWith("user_id", "owner"); expect(sdk.chain.order).toHaveBeenCalledWith("name");
  });
  it("preserves the original empty-list result on a returned read error", async () => {
    sdk.result.error = new Error("denied"); expect(await memberService.list("owner")).toEqual([]);
  });
  it("normalizes custom fields and keeps descending batch order", async () => {
    sdk.result.data = [{ id: "b", custom_fields: null }];
    expect(await memberService.listBatches("owner")).toEqual([{ id: "b", custom_fields: [] }]);
    expect(sdk.chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
  it("avoids a profiles request when no staff are present", async () => {
    sdk.result.data = []; expect(await memberService.listStaff("owner")).toEqual([]); expect(sdk.from).toHaveBeenCalledTimes(1);
  });
  it("rejects write errors", async () => {
    sdk.result.error = new Error("denied");
    await expect(memberService.linkPhoto("m", "path")).rejects.toThrow("denied");
    await expect(memberService.deletePayments("m")).rejects.toThrow("denied");
    await expect(memberService.deleteRecord("m")).rejects.toThrow("denied");
  });
  it("uploads with the original content type and propagates errors", async () => {
    const file = new File(["x"], "x.png", { type: "image/png" }); sdk.storage.upload.mockResolvedValue({ error: null });
    await memberService.uploadPhoto("owner/member/photo.png", file);
    expect(sdk.storage.upload).toHaveBeenCalledWith("owner/member/photo.png", file, { contentType: "image/png" });
    sdk.storage.upload.mockResolvedValue({ error: new Error("denied") });
    await expect(memberService.uploadPhoto("path", file)).rejects.toThrow("denied");
  });
  it("keeps cleanup response errors nonblocking as before", async () => {
    sdk.storage.remove.mockResolvedValue({ error: new Error("denied") });
    await expect(memberService.removePhoto("old")).resolves.toBeUndefined();
  });
  it("uses five-minute signed photo URLs", async () => {
    sdk.storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "private-url" }, error: null });
    expect(await memberService.photoUrl("m", "path")).toBe("private-url");
    expect(sdk.storage.createSignedUrl).toHaveBeenCalledWith("path", 300);
  });
  it("subscribes to both scoped tables and disposes the channel", () => {
    const members = vi.fn(); const batches = vi.fn(); const dispose = memberService.subscribe("owner", members, batches);
    expect(sdk.channel.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "students", filter: "user_id=eq.owner" }), members);
    expect(sdk.channel.on).toHaveBeenCalledWith("postgres_changes", expect.objectContaining({ table: "batches", filter: "user_id=eq.owner" }), batches);
    dispose(); expect(sdk.removeChannel).toHaveBeenCalledWith(sdk.channel);
  });
});