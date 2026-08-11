CREATE OR REPLACE FUNCTION public.transfer_ownership(_new_owner uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cur uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT user_id INTO _cur FROM public.user_roles
   WHERE role = 'owner' ORDER BY created_at ASC LIMIT 1;

  IF _cur IS NULL OR _cur <> _uid THEN
    RAISE EXCEPTION 'Only the current Owner can transfer ownership';
  END IF;
  IF _new_owner = _uid THEN RAISE EXCEPTION 'You are already the Owner'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _new_owner AND role = 'staff' AND owner_id = _uid
  ) THEN
    RAISE EXCEPTION 'The new owner must be an active Staff member of this workspace';
  END IF;

  -- Move every workspace record to the new owner (same data, same workspace).
  UPDATE public.students          SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.batches           SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.student_payments  SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.attendance        SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.biometric_devices SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.gallery_items     SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.live_classes      SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.recordings        SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.offers            SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.coupons           SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.offer_redemptions SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.learning_insights SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.insight_fields    SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.instructors       SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.locations         SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.expenses          SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.chatbot_knowledge         SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.chatbot_pending_questions SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.chatbot_chat_history      SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.payment_audit_logs        SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.staff_invitations         SET owner_id = _new_owner WHERE owner_id = _cur;

  -- Settings & security travel with the workspace.
  DELETE FROM public.studio_settings WHERE owner_id = _new_owner;
  UPDATE public.studio_settings SET owner_id = _new_owner WHERE owner_id = _cur;
  DELETE FROM public.studio_security WHERE owner_id = _new_owner;
  UPDATE public.studio_security SET owner_id = _new_owner WHERE owner_id = _cur;

  -- Swap roles.
  UPDATE public.user_roles SET role = 'owner', owner_id = _new_owner WHERE user_id = _new_owner;
  UPDATE public.user_roles SET role = 'staff', owner_id = _new_owner WHERE user_id = _cur;
  UPDATE public.user_roles SET owner_id = _new_owner WHERE owner_id = _cur;

  -- Staff permission rows follow the new owner; previous owner becomes staff.
  UPDATE public.staff_permissions SET owner_id = _new_owner WHERE owner_id = _cur;
  DELETE FROM public.staff_permissions WHERE staff_user_id = _new_owner;
  -- Previous Owner gets the default Staff access: Members only. The new Owner
  -- can grant additional modules from Settings → Staff & Permissions.
  INSERT INTO public.staff_permissions (
    owner_id, staff_user_id, can_customers, can_gallery, can_classes, can_payments, can_renewals, is_active
  ) VALUES (_new_owner, _cur, true, false, false, false, false, true)
  ON CONFLICT (staff_user_id) DO UPDATE
    SET owner_id = _new_owner, is_active = true,
        can_customers = true, can_gallery = false, can_classes = false,
        can_payments = false, can_renewals = false;

  RETURN 'transferred';
END;
$function$