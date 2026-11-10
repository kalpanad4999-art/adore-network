CREATE TABLE public.attendance_batch_schedules (
 batch_id uuid PRIMARY KEY REFERENCES public.batches(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL,
 weekdays integer[] NOT NULL DEFAULT '{}',
 effective_from date NOT NULL DEFAULT CURRENT_DATE,
 CONSTRAINT schedule_weekdays_valid CHECK (weekdays <@ ARRAY[0,1,2,3,4,5,6])
);
GRANT SELECT, INSERT, UPDATE ON public.attendance_batch_schedules TO authenticated;
GRANT ALL ON public.attendance_batch_schedules TO service_role;
ALTER TABLE public.attendance_batch_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance workspace reads schedules" ON public.attendance_batch_schedules FOR SELECT TO authenticated USING ((owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'))) AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = batch_id AND b.user_id = owner_id));
CREATE POLICY "Attendance workspace creates schedules" ON public.attendance_batch_schedules FOR INSERT TO authenticated WITH CHECK ((owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'))) AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = batch_id AND b.user_id = owner_id));
CREATE POLICY "Attendance workspace edits schedules" ON public.attendance_batch_schedules FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'))) WITH CHECK ((owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'))) AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = batch_id AND b.user_id = owner_id));
CREATE TABLE public.attendance_absence_followups (
 owner_id uuid NOT NULL,
 batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
 streak_start date NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now(),
 sent_by uuid NOT NULL DEFAULT auth.uid(),
 PRIMARY KEY (owner_id, batch_id, student_id, streak_start)
);
GRANT SELECT, INSERT ON public.attendance_absence_followups TO authenticated;
GRANT ALL ON public.attendance_absence_followups TO service_role;
ALTER TABLE public.attendance_absence_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance workspace reads followups" ON public.attendance_absence_followups FOR SELECT TO authenticated USING ((owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'))) AND public.can_access_student(auth.uid(), student_id));
CREATE POLICY "Attendance workspace confirms followups" ON public.attendance_absence_followups FOR INSERT TO authenticated WITH CHECK (sent_by = auth.uid() AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'))) AND public.can_access_student(auth.uid(), student_id) AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = owner_id AND s.batch_id = batch_id));
CREATE FUNCTION public.attendance_absence_members(_owner uuid) RETURNS TABLE (id uuid, name text, phone text, batch_id uuid, registered_on date, valid_until date) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT s.id, s.name, s.phone, s.batch_id, (s.created_at AT TIME ZONE 'Asia/Kolkata')::date, p.valid_until
 FROM public.students s
 LEFT JOIN LATERAL (SELECT sp.valid_until FROM public.student_payments sp WHERE sp.student_id = s.id AND sp.user_id = _owner ORDER BY sp.paid_on DESC, sp.created_at DESC LIMIT 1) p ON true
 WHERE s.user_id = _owner
 AND (_owner = auth.uid() OR (_owner = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance')))
 AND public.can_access_student(auth.uid(), s.id);
$$;
REVOKE ALL ON FUNCTION public.attendance_absence_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attendance_absence_members(uuid) TO authenticated, service_role;