import { supabase } from "@/integrations/supabase/client";
import type { Batch, BatchPayload, Customer, MemberPayload, StaffOption } from "../types";

/** Current Cloud adapter. Keep query builders and storage details out of screens. */
export const memberService = {
  async list(workspaceId: string): Promise<Customer[]> {
    const { data } = await supabase.from("students").select("id,name,email,phone,address,notes,height_cm,weight_kg,batch_id,assigned_staff_id,custom_data,photo_path").eq("user_id", workspaceId).order("name");
    return (data || []).map((c) => ({ ...c, custom_data: c.custom_data && typeof c.custom_data === "object" ? c.custom_data : {} })) as Customer[];
  },
  async listBatches(workspaceId: string): Promise<Batch[]> {
    const { data } = await supabase.from("batches").select("*").eq("user_id", workspaceId).order("created_at", { ascending: false });
    return (data || []).map((b) => ({ ...b, custom_fields: Array.isArray(b.custom_fields) ? b.custom_fields : [] })) as unknown as Batch[];
  },
  async listStaff(workspaceId: string): Promise<StaffOption[]> {
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("owner_id", workspaceId).eq("role", "staff");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (!ids.length) return [];
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    return ids.map((id) => {
      const profile = (profiles ?? []).find((p) => p.id === id);
      return { id, name: profile?.full_name || profile?.email || "Staff member" };
    });
  },
  async save(payload: MemberPayload, id: string | null) {
    const { data, error } = id
      ? await supabase.from("students").update(payload).eq("id", id).select("id,photo_path").single()
      : await supabase.from("students").insert(payload).select("id,photo_path").single();
    if (error || !data) throw error ?? new Error("Could not save member");
    return data;
  },
  async uploadPhoto(path: string, photo: File) {
    const { error } = await supabase.storage.from("member-photos").upload(path, photo, { contentType: photo.type });
    if (error) throw error;
  },
  async linkPhoto(id: string, path: string | null) {
    const { error } = await supabase.from("students").update({ photo_path: path }).eq("id", id);
    if (error) throw error;
  },
  // Cleanup responses were not blocking in the original workflow; preserve that here.
  async removePhoto(path: string) { await supabase.storage.from("member-photos").remove([path]); },
  async restorePhoto(id: string, path: string | null) { await supabase.from("students").update({ photo_path: path }).eq("id", id); },
  async photoUrl(id: string, path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from("member-photos").createSignedUrl(path, 300);
    if (error) console.error("[face-photo] Signed photo URL creation failed", { memberId: id, error });
    else console.info("[face-photo] Signed photo URL created", { memberId: id });
    return data?.signedUrl ?? null;
  },
  async deletePayments(id: string) {
    const { error } = await supabase.from("student_payments").delete().eq("student_id", id);
    if (error) throw error;
  },
  async deleteRecord(id: string) {
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) throw error;
  },
  async assignStaff(id: string, staffId: string | null) {
    return await supabase.from("students").update({ assigned_staff_id: staffId }).eq("id", id);
  },
  async move(id: string, batchId: string) {
    return await supabase.from("students").update({ batch_id: batchId }).eq("id", id);
  },
  async saveBatch(payload: BatchPayload, id: string | null) {
    const value = { ...payload, custom_fields: payload.custom_fields.map((field) => ({ ...field })) };
    return id ? await supabase.from("batches").update(value).eq("id", id) : await supabase.from("batches").insert(value);
  },
  async deleteBatch(id: string) { await supabase.from("batches").delete().eq("id", id); },
  subscribe(workspaceId: string, onMembers: () => void, onBatches: () => void) {
    const channel = supabase.channel(`customers-sync-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${workspaceId}` }, onMembers)
      .on("postgres_changes", { event: "*", schema: "public", table: "batches", filter: `user_id=eq.${workspaceId}` }, onBatches).subscribe();
    return () => { void supabase.removeChannel(channel); };
  },
};