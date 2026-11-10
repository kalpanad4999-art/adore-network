import { supabase } from "@/integrations/supabase/client";
import type { SharingAttendance } from "@/lib/attendanceSharing";
import type { AbsenceMember, BatchSchedule, SentFollowup, AbsenceAlert } from "./absenceRules";

export async function loadAbsenceData(ownerId: string) {
  const [members, schedules, followups] = await Promise.all([
    supabase.rpc("attendance_absence_members", { _owner: ownerId }),
    supabase.from("attendance_batch_schedules").select("batch_id,weekdays,effective_from").eq("owner_id", ownerId),
    supabase.from("attendance_absence_followups").select("batch_id,student_id,streak_start").eq("owner_id", ownerId),
  ]);
  for (const response of [members, schedules, followups]) if (response.error) throw response.error;
  const records: SharingAttendance[] = [];
  // Do not infer absences from the Attendance screen's truncated history.
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.from("attendance").select("student_id,batch_id,attendance_date,status").eq("user_id", ownerId).order("id").range(offset, offset + 999);
    if (page.error) throw page.error;
    records.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  return { members: (members.data ?? []) as AbsenceMember[], schedules: (schedules.data ?? []) as BatchSchedule[], sent: (followups.data ?? []) as SentFollowup[], records };
}

export async function saveBatchSchedule(ownerId: string, schedule: BatchSchedule) {
  const { error } = await supabase.from("attendance_batch_schedules").upsert({ owner_id: ownerId, ...schedule }, { onConflict: "batch_id" });
  if (error) throw error;
}
export async function confirmAbsenceSent(ownerId: string, alert: AbsenceAlert) {
  const { error } = await supabase.from("attendance_absence_followups").insert({ owner_id: ownerId, batch_id: alert.batchId, student_id: alert.member.id, streak_start: alert.streakStart });
  // A different staff member may already have confirmed this exact streak.
  if (error && error.code !== "23505") throw error;
}