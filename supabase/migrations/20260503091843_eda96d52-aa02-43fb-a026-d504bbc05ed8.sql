
-- 1) Remove public-role write policies on studio-backgrounds (authenticated equivalents remain)
DROP POLICY IF EXISTS "Owners upload their own backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Owners update their own backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete their own backgrounds" ON storage.objects;

-- 2) Staff workspace access policies for shared business tables
CREATE POLICY "Staff manages owner instructors"
ON public.instructors FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Staff manages owner expenses"
ON public.expenses FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Staff manages owner locations"
ON public.locations FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Staff manages owner batches"
ON public.batches FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

-- 3) Invitee can view their own pending invitation
CREATE POLICY "Invitee can view own invitation"
ON public.staff_invitations FOR SELECT TO authenticated
USING (lower(email) = lower((SELECT email FROM public.profiles WHERE id = auth.uid())));
