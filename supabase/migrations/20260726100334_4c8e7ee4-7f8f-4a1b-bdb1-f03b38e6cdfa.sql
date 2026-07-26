
-- 1) Fix attendance RLS: restrict "Owners manage attendance" to true owners,
-- add explicit staff policies gated by staff_has_permission.

DROP POLICY IF EXISTS "Owners manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff with permission can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Owners full access attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff select attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff delete attendance" ON public.attendance;

-- Owner (true row owner) gets full access
CREATE POLICY "Owners full access attendance"
  ON public.attendance
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Staff (linked to an owner) can operate on that owner's attendance rows
-- only when they hold either 'customers' or 'classes' permission.
CREATE POLICY "Staff select attendance"
  ON public.attendance
  FOR SELECT
  TO authenticated
  USING (
    user_id = public.get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(), 'customers')
         OR public.staff_has_permission(auth.uid(), 'classes'))
  );

CREATE POLICY "Staff insert attendance"
  ON public.attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = public.get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(), 'customers')
         OR public.staff_has_permission(auth.uid(), 'classes'))
  );

CREATE POLICY "Staff update attendance"
  ON public.attendance
  FOR UPDATE
  TO authenticated
  USING (
    user_id = public.get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(), 'customers')
         OR public.staff_has_permission(auth.uid(), 'classes'))
  )
  WITH CHECK (
    user_id = public.get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(), 'customers')
         OR public.staff_has_permission(auth.uid(), 'classes'))
  );

CREATE POLICY "Staff delete attendance"
  ON public.attendance
  FOR DELETE
  TO authenticated
  USING (
    user_id = public.get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(), 'customers')
         OR public.staff_has_permission(auth.uid(), 'classes'))
  );

-- 2) Revoke EXECUTE from PUBLIC/anon/authenticated on functions that should
-- NOT be callable by clients. These are internal trigger helpers and
-- admin/service-role RPCs. Public-facing RPCs (get_public_*, get_batch_by_token,
-- register_student_via_token, get_recording_by_slug, get_default_studio_meta,
-- get_email_by_phone used by phone login) are intentionally left executable.

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_staff_permissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recordings_set_slug() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_live_class_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) FROM PUBLIC, anon;

-- Restrict internal role/permission checks to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) TO authenticated;
