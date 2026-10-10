import type { CustomField, MemberForm, MemberPayload } from "../types";

const phoneRegex = /^[+\d][\d\s\-()]{6,19}$/;

/** Authenticated member form rules. Public Join retains its SQL-backed validation. */
export function memberPayload(form: MemberForm, custom: Record<string, string>, fields: CustomField[], workspaceId: string, batchId: string): MemberPayload {
  if (form.phone && !phoneRegex.test(form.phone.trim())) throw new Error("Enter a valid phone");
  const height = form.height ? Number(form.height) : null;
  const weight = form.weight ? Number(form.weight) : null;
  if (height !== null && (Number.isNaN(height) || height < 30 || height > 272)) throw new Error("Enter a valid height in cm");
  if (weight !== null && (Number.isNaN(weight) || weight < 2 || weight > 500)) throw new Error("Enter a valid weight in kg");
  const values: Record<string, string> = {};
  for (const field of fields.filter((f) => f.enabled !== false)) {
    const value = (custom[field.id] || "").trim();
    if (field.required && !value) throw new Error(`${field.name} is required`);
    if (value) values[field.id] = value.slice(0, 500);
  }
  return { user_id: workspaceId, batch_id: batchId, name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null, height_cm: height, weight_kg: weight, custom_data: values };
}