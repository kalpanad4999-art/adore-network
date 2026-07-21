DROP POLICY IF EXISTS "Staff reads owner batches" ON public.batches;
CREATE POLICY "Staff reads owner batches" ON public.batches
FOR SELECT
USING (
  user_id = public.get_owner_id(auth.uid())
  AND (
    public.staff_has_permission(auth.uid(), 'customers')
    OR public.staff_has_permission(auth.uid(), 'renewals')
    OR public.staff_has_permission(auth.uid(), 'payments')
  )
);