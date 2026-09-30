DROP POLICY IF EXISTS "Member editors upload private photos" ON storage.objects;
CREATE POLICY "Member editors upload private photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'member-photos'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = (storage.foldername(storage.objects.name))[2]
      AND s.user_id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        (s.user_id = auth.uid() AND public.has_role(auth.uid(), 'owner'))
        OR (s.user_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers'))
      )
  )
);
DROP POLICY IF EXISTS "Member editors remove private photos" ON storage.objects;
CREATE POLICY "Member editors remove private photos" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'member-photos'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = (storage.foldername(storage.objects.name))[2]
      AND s.user_id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        (s.user_id = auth.uid() AND public.has_role(auth.uid(), 'owner'))
        OR (s.user_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers'))
      )
  )
);
DROP POLICY IF EXISTS "Workspace reads private member photos" ON storage.objects;
CREATE POLICY "Workspace reads private member photos" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'member-photos'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = (storage.foldername(storage.objects.name))[2]
      AND s.user_id::text = (storage.foldername(storage.objects.name))[1]
      AND (
        (s.user_id = auth.uid() AND public.has_role(auth.uid(), 'owner'))
        OR (s.user_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid()
          AND (public.staff_has_permission(auth.uid(), 'customers') OR public.staff_has_permission(auth.uid(), 'attendance')))
      )
  )
);