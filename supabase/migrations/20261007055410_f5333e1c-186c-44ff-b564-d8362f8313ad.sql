ALTER TABLE public.member_face_enrollments ADD COLUMN IF NOT EXISTS descriptor real[];
ALTER TABLE public.member_face_enrollments ALTER COLUMN provider_face_id DROP NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_face_enrollments TO authenticated;
CREATE POLICY "Workspace reads face descriptors" ON public.member_face_enrollments FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND (public.staff_has_permission(auth.uid(),'attendance') OR public.staff_has_permission(auth.uid(),'customers'))));
CREATE POLICY "Authorized users save face descriptors" ON public.member_face_enrollments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(),'customers')))));
CREATE POLICY "Authorized users replace face descriptors" ON public.member_face_enrollments FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(),'customers')))))
WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(),'customers')))));
CREATE POLICY "Authorized users remove face descriptors" ON public.member_face_enrollments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(),'customers')))));