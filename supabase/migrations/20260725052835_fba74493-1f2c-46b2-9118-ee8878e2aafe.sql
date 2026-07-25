
DELETE FROM public.student_payments
WHERE student_id NOT IN (SELECT id FROM public.students);

ALTER TABLE public.student_payments
  ADD CONSTRAINT student_payments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

CREATE POLICY "Staff deletes owner students"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'customers'));
