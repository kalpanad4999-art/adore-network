-- 1. Phone -> email oracle: no longer exposed to clients
REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM anon, authenticated, PUBLIC;

-- 2. Scope staff/owner policies to authenticated instead of public role
DROP POLICY IF EXISTS "Staff reads owner batches" ON public.batches;
CREATE POLICY "Staff reads owner batches" ON public.batches FOR SELECT TO authenticated
USING ((user_id = get_owner_id(auth.uid())) AND (staff_has_permission(auth.uid(),'customers') OR staff_has_permission(auth.uid(),'renewals') OR staff_has_permission(auth.uid(),'payments')));

DROP POLICY IF EXISTS "Staff writes owner batches" ON public.batches;
CREATE POLICY "Staff writes owner batches" ON public.batches FOR INSERT TO authenticated
WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'customers'));

DROP POLICY IF EXISTS "Staff updates owner batches" ON public.batches;
CREATE POLICY "Staff updates owner batches" ON public.batches FOR UPDATE TO authenticated
USING ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'customers'))
WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'customers'));

DROP POLICY IF EXISTS "Staff deletes owner batches" ON public.batches;
CREATE POLICY "Staff deletes owner batches" ON public.batches FOR DELETE TO authenticated
USING ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'customers'));

DROP POLICY IF EXISTS "Owner manages KB" ON public.chatbot_knowledge;
CREATE POLICY "Owner manages KB" ON public.chatbot_knowledge FOR ALL TO authenticated
USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Staff manages owner expenses" ON public.expenses;
CREATE POLICY "Staff manages owner expenses" ON public.expenses FOR ALL TO authenticated
USING ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'payments'))
WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'payments'));

DROP POLICY IF EXISTS "Staff manages owner gallery" ON public.gallery_items;
CREATE POLICY "Staff manages owner gallery" ON public.gallery_items FOR ALL TO authenticated
USING ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'gallery'))
WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(),'gallery'));

DROP POLICY IF EXISTS "Owner manages staff perms" ON public.staff_permissions;
CREATE POLICY "Owner manages staff perms" ON public.staff_permissions FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Staff reads own perms" ON public.staff_permissions;
CREATE POLICY "Staff reads own perms" ON public.staff_permissions FOR SELECT TO authenticated
USING (auth.uid() = staff_user_id);

-- 3. Instructors: hard restriction so no future policy can expose compensation data to staff
DROP POLICY IF EXISTS "Instructors owner only" ON public.instructors;
CREATE POLICY "Instructors owner only" ON public.instructors AS RESTRICTIVE FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.instructors FROM anon;