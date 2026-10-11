import { describe, expect, it } from "vitest";
import { memberPayload } from "./memberValidation";
import type { MemberForm } from "../types";

const form: MemberForm = { name: " Member ", email: "", phone: "", address: "", notes: "", height: "", weight: "" };
const build = (patch: Partial<MemberForm> = {}) => memberPayload({ ...form, ...patch }, {}, [], "owner", "batch");
describe("member form rules", () => {
  it("trims fields, retains workspace/batch and converts blanks to null", () => {
    expect(build()).toEqual({ user_id: "owner", batch_id: "batch", name: "Member", email: null, phone: null, address: null, notes: null, height_cm: null, weight_kg: null, custom_data: {} });
  });
  it.each(["bad", "123", "   "])("rejects invalid phone %s", (phone) => expect(() => build({ phone })).toThrow("Enter a valid phone"));
  it("accepts existing phone syntax", () => expect(build({ phone: " +91 9999999999 " }).phone).toBe("+91 9999999999"));
  it.each(["29", "273", "abc"])("rejects height %s", (height) => expect(() => build({ height })).toThrow("Enter a valid height in cm"));
  it.each(["1", "501", "abc"])("rejects weight %s", (weight) => expect(() => build({ weight })).toThrow("Enter a valid weight in kg"));
  it("accepts inclusive measurement bounds", () => {
    expect(build({ height: "30", weight: "2" })).toMatchObject({ height_cm: 30, weight_kg: 2 });
    expect(build({ height: "272", weight: "500" })).toMatchObject({ height_cm: 272, weight_kg: 500 });
  });
  it("requires enabled custom fields but ignores disabled values", () => {
    const fields = [{ id: "a", name: "Contact", required: true, enabled: true }, { id: "b", name: "Disabled", required: true, enabled: false }];
    expect(() => memberPayload(form, {}, fields, "o", "b")).toThrow("Contact is required");
    expect(memberPayload(form, { a: " value ", b: "hidden" }, fields, "o", "b").custom_data).toEqual({ a: "value" });
  });
  it("caps custom values at 500 characters", () => {
    expect(memberPayload(form, { a: "x".repeat(501) }, [{ id: "a", name: "Note", required: false, enabled: true }], "o", "b").custom_data.a).toHaveLength(500);
  });
});