import type { SharingAttendance } from "@/lib/attendanceSharing";

export type AbsenceMember = { id: string; name: string; phone: string | null; batch_id: string | null; registered_on: string; valid_until: string | null };
export type BatchSchedule = { batch_id: string; weekdays: number[]; effective_from: string };
export type SentFollowup = { batch_id: string; student_id: string; streak_start: string };
export type AbsenceAlert = { member: AbsenceMember; batchId: string; streakStart: string; missedDays: number; lastAttendance: string | null };
export const absenceMessage = (name: string) => `Hi ${name}, we missed seeing you on the mat at Trinetra Yoga this week! Is everything okay with your health and schedule?`;
export const indiaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const alertKey = (a: Pick<AbsenceAlert, "batchId" | "streakStart"> & { member: { id: string } }) => `${a.batchId}:${a.member.id}:${a.streakStart}`;

// Only completed class dates count. The current day may still have a class later.
export function buildAbsenceAlerts(members: AbsenceMember[], schedules: BatchSchedule[], records: SharingAttendance[], sent: SentFollowup[], today: string): AbsenceAlert[] {
  const dismissed = new Set(sent.map((s) => `${s.batch_id}:${s.student_id}:${s.streak_start}`));
  const result: AbsenceAlert[] = [];
  for (const member of members) {
    const schedule = schedules.find((s) => s.batch_id === member.batch_id);
    if (!schedule?.weekdays.length || !member.valid_until || !member.registered_on) continue;
    const start = [member.registered_on, schedule.effective_from].sort().at(-1);
    if (!start) continue;
    const end = member.valid_until < today ? member.valid_until : today;
    const own = records.filter((r) => r.student_id === member.id && r.batch_id === schedule.batch_id);
    const present = new Set(own.filter((r) => r.status === "present").map((r) => r.attendance_date));
    const lastAttendance = [...present].filter((d) => d <= end).sort().at(-1) ?? null;
    const cursor = new Date(`${start}T00:00:00Z`);
    let streakStart = "", missedDays = 0;
    while (Number.isFinite(cursor.getTime())) {
      const date = cursor.toISOString().slice(0, 10);
      if (date > end || date >= today) break;
      // Attendance on any day breaks a streak, even if the schedule was changed.
      if (present.has(date)) { streakStart = ""; missedDays = 0; }
      else if (schedule.weekdays.includes(cursor.getUTCDay())) {
        if (!streakStart) streakStart = date;
        missedDays++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const alert = { member, batchId: schedule.batch_id, streakStart, missedDays, lastAttendance };
    if (missedDays >= 3 && !dismissed.has(alertKey(alert))) result.push(alert);
  }
  return result;
}