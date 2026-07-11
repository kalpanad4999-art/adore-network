
-- 1) Staff privilege escalation: drop staff-wide ALL policies on instructors, locations, chatbot_knowledge.
--    These modules have no corresponding staff_has_permission column, so restrict management to the owner only.
DROP POLICY IF EXISTS "Staff manages owner instructors" ON public.instructors;
DROP POLICY IF EXISTS "Staff manages owner locations" ON public.locations;

-- chatbot_knowledge: replace policy so only the owner (not any staff via get_owner_id) can manage
DROP POLICY IF EXISTS "Owner manages KB" ON public.chatbot_knowledge;
CREATE POLICY "Owner manages KB"
ON public.chatbot_knowledge
FOR ALL
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 2) staff_has_permission: deny by default when no permissions row exists (remove grandfathering)
CREATE OR REPLACE FUNCTION public.staff_has_permission(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _row public.staff_permissions%ROWTYPE;
BEGIN
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN
    RETURN false;
  END IF;
  IF _role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT * INTO _row FROM public.staff_permissions WHERE staff_user_id = _user_id;
  IF NOT FOUND OR NOT _row.is_active THEN
    RETURN false;
  END IF;

  RETURN CASE _module
    WHEN 'customers' THEN _row.can_customers
    WHEN 'gallery'   THEN _row.can_gallery
    WHEN 'classes'   THEN _row.can_classes
    WHEN 'payments'  THEN _row.can_payments
    WHEN 'renewals'  THEN _row.can_renewals
    ELSE false
  END;
END;
$function$;

-- 3) SECURITY DEFINER function exposure: revoke EXECUTE from PUBLIC/anon/authenticated on internal helpers.
--    Keep EXECUTE for the intentionally public registration/read RPCs.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_staff_permissions() FROM PUBLIC, anon, authenticated;
