
-- Delete every account except the permanent Owner (kalpanad4999@gmail.com).
-- Cascading FKs on public tables clean up profiles, user_roles, staff_permissions, etc.
DO $$
DECLARE
  _owner uuid;
BEGIN
  SELECT id INTO _owner FROM auth.users WHERE lower(email) = 'kalpanad4999@gmail.com' LIMIT 1;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Permanent owner account not found';
  END IF;

  -- Remove any residual public-schema rows tied to non-owner users first
  DELETE FROM public.staff_permissions WHERE staff_user_id <> _owner OR owner_id <> _owner;
  DELETE FROM public.user_roles WHERE user_id <> _owner;
  DELETE FROM public.profiles WHERE id <> _owner;
  DELETE FROM public.staff_invitations WHERE owner_id <> _owner;

  -- Finally remove the auth accounts themselves
  DELETE FROM auth.users WHERE id <> _owner;

  -- Guarantee the permanent owner row is intact
  INSERT INTO public.user_roles (user_id, owner_id, role)
    VALUES (_owner, _owner, 'owner')
    ON CONFLICT DO NOTHING;
END $$;

-- Harden the signup trigger: no email other than the permanent owner may ever
-- receive the 'owner' role. All other signups become staff of the permanent owner.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invite RECORD;
  _perm_owner uuid;
BEGIN
  SELECT id INTO _perm_owner FROM auth.users
   WHERE lower(email) = 'kalpanad4999@gmail.com' LIMIT 1;

  -- Permanent owner signs in for the first time
  IF _perm_owner IS NOT NULL AND NEW.id = _perm_owner THEN
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, NEW.id, 'owner')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.studio_settings (owner_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Everyone else becomes Staff of the permanent Owner. Owners can never be
  -- created through signup. Legacy invitations still get marked accepted.
  IF _perm_owner IS NULL THEN
    -- Safety net: if the permanent owner has not signed up yet, do nothing
    -- rather than promoting a stranger to owner.
    RETURN NEW;
  END IF;

  SELECT * INTO _invite FROM public.staff_invitations
   WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL LIMIT 1;

  INSERT INTO public.user_roles (user_id, owner_id, role)
    VALUES (NEW.id, _perm_owner, 'staff')
    ON CONFLICT DO NOTHING;

  IF _invite.id IS NOT NULL THEN
    UPDATE public.staff_invitations SET accepted_at = now() WHERE id = _invite.id;
  END IF;
  RETURN NEW;
END;
$function$;
