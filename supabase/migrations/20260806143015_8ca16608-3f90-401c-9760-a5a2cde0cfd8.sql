
-- 1. Invitation hardening -----------------------------------------------
ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_token_key ON public.staff_invitations(token);

-- 2. One role per user ---------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_key ON public.user_roles(user_id);

-- 3. Current workspace owner --------------------------------------------
CREATE OR REPLACE FUNCTION public.current_workspace_owner()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.current_workspace_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_workspace_owner() TO authenticated, service_role;

-- 4. Invitation preview (public, token-gated) ----------------------------
CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token uuid)
RETURNS TABLE(email text, studio_name text, invited_at timestamptz, expires_at timestamptz, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _inv RECORD; _name text;
BEGIN
  SELECT * INTO _inv FROM public.staff_invitations WHERE staff_invitations.token = _token LIMIT 1;
  IF _inv.id IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz, 'invalid'::text;
    RETURN;
  END IF;
  SELECT s.studio_name INTO _name FROM public.studio_settings s WHERE s.owner_id = _inv.owner_id LIMIT 1;
  RETURN QUERY SELECT
    _inv.email,
    COALESCE(_name, 'TRINETRA YOGA'),
    _inv.created_at,
    _inv.expires_at,
    CASE
      WHEN _inv.revoked_at IS NOT NULL THEN 'revoked'
      WHEN _inv.accepted_at IS NOT NULL THEN 'accepted'
      WHEN _inv.expires_at <= now() THEN 'expired'
      ELSE 'pending'
    END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_invitation_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid) TO anon, authenticated, service_role;

-- 5. Accept invitation ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_staff_invitation(_token uuid)
RETURNS TABLE(owner_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _inv RECORD;
  _existing public.app_role;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invitation';
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = _uid;

  SELECT * INTO _inv FROM public.staff_invitations i
   WHERE i.token = _token FOR UPDATE;

  IF _inv.id IS NULL THEN RAISE EXCEPTION 'This invitation link is not valid'; END IF;
  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invitation has been revoked'; END IF;
  IF _inv.expires_at <= now() THEN RAISE EXCEPTION 'This invitation has expired'; END IF;
  IF lower(_inv.email) IS DISTINCT FROM _email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  SELECT r.role INTO _existing FROM public.user_roles r WHERE r.user_id = _uid;
  IF _existing = 'owner' THEN
    RETURN QUERY SELECT _inv.owner_id, 'already_owner'::text;
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, owner_id, role)
  VALUES (_uid, _inv.owner_id, 'staff')
  ON CONFLICT (user_id) DO UPDATE SET owner_id = EXCLUDED.owner_id, role = 'staff';

  INSERT INTO public.staff_permissions (
    owner_id, staff_user_id, can_customers, can_gallery, can_classes, can_payments, can_renewals, is_active
  ) VALUES (_inv.owner_id, _uid, false, false, false, false, false, true)
  ON CONFLICT (staff_user_id) DO UPDATE SET owner_id = EXCLUDED.owner_id;

  UPDATE public.staff_invitations
     SET accepted_at = COALESCE(accepted_at, now()), accepted_by = _uid
   WHERE id = _inv.id;

  RETURN QUERY SELECT _inv.owner_id, 'accepted'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) TO authenticated, service_role;

-- 6. Signup trigger: never auto-owner (except empty workspace bootstrap) --
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _invite RECORD;
BEGIN
  SELECT user_id INTO _owner FROM public.user_roles
   WHERE role = 'owner' ORDER BY created_at ASC LIMIT 1;

  -- Bootstrap: the very first account in an empty workspace becomes Owner.
  IF _owner IS NULL THEN
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, NEW.id, 'owner') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.studio_settings (owner_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Otherwise: only a pending, unexpired invitation grants a Staff account.
  SELECT * INTO _invite FROM public.staff_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;

  IF _invite.id IS NULL THEN
    RETURN NEW; -- no role => "not authorized"
  END IF;

  INSERT INTO public.user_roles (user_id, owner_id, role)
    VALUES (NEW.id, _invite.owner_id, 'staff')
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.staff_invitations
     SET accepted_at = now(), accepted_by = NEW.id
   WHERE id = _invite.id;

  RETURN NEW;
END;
$$;

-- 7. Default studio meta follows the current owner ------------------------
CREATE OR REPLACE FUNCTION public.get_default_studio_meta()
RETURNS TABLE(owner_id uuid, studio_name text, logo_url text, background_url text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _perm uuid;
BEGIN
  SELECT ur.user_id INTO _perm FROM public.user_roles ur
   WHERE ur.role = 'owner' ORDER BY ur.created_at ASC LIMIT 1;
  RETURN QUERY
  SELECT s.owner_id, s.studio_name, s.logo_url, s.background_url
    FROM public.studio_settings s WHERE s.owner_id = _perm LIMIT 1;
END;
$$;

-- 8. Transfer ownership ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_ownership(_new_owner uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  INSERT INTO public.staff_permissions (
    owner_id, staff_user_id, can_customers, can_gallery, can_classes, can_payments, can_renewals, is_active
  ) VALUES (_new_owner, _cur, true, true, true, true, true, true)
  ON CONFLICT (staff_user_id) DO UPDATE
    SET owner_id = _new_owner, is_active = true,
        can_customers = true, can_gallery = true, can_classes = true,
        can_payments = true, can_renewals = true;

  RETURN 'transferred';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_ownership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid) TO authenticated, service_role;
