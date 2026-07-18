
-- 1) Update handle_new_user_role() to use kalpanad4999@gmail.com as the permanent owner
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

  -- Legacy invite path still supported
  SELECT * INTO _invite FROM public.staff_invitations
   WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL LIMIT 1;
  IF _invite.id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, _invite.owner_id, 'staff')
      ON CONFLICT DO NOTHING;
    UPDATE public.staff_invitations SET accepted_at = now() WHERE id = _invite.id;
    RETURN NEW;
  END IF;

  -- Default: every new registration becomes Staff of the permanent Owner
  IF _perm_owner IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, _perm_owner, 'staff')
      ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, NEW.id, 'owner')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.studio_settings (owner_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Update get_default_studio_meta() to reference kalpanad4999@gmail.com
CREATE OR REPLACE FUNCTION public.get_default_studio_meta()
 RETURNS TABLE(owner_id uuid, studio_name text, logo_url text, background_url text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _perm uuid;
BEGIN
  SELECT id INTO _perm FROM auth.users
   WHERE lower(email) = 'kalpanad4999@gmail.com' LIMIT 1;
  IF _perm IS NULL THEN
    SELECT ur.user_id INTO _perm FROM public.user_roles ur
     WHERE ur.role = 'owner' ORDER BY ur.created_at ASC LIMIT 1;
  END IF;
  RETURN QUERY
  SELECT s.owner_id, s.studio_name, s.logo_url, s.background_url
    FROM public.studio_settings s WHERE s.owner_id = _perm LIMIT 1;
END;
$function$;

-- 3) Reassign any business data owned by non-owner users to the permanent owner,
--    then delete all auth users except the permanent owner.
DO $$
DECLARE
  _perm uuid;
  _tbl text;
BEGIN
  SELECT id INTO _perm FROM auth.users WHERE lower(email) = 'kalpanad4999@gmail.com';
  IF _perm IS NULL THEN RAISE EXCEPTION 'Permanent owner not found'; END IF;

  -- Reassign every table that has a user_id column pointing to the studio owner
  FOR _tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
      AND c.table_name NOT IN ('user_roles','staff_permissions','profiles','chatbot_chat_history','attendance')
  LOOP
    EXECUTE format('UPDATE public.%I SET user_id = %L WHERE user_id <> %L', _tbl, _perm, _perm);
  END LOOP;

  -- Ensure staff_permissions/user_roles owner_id points at the permanent owner
  UPDATE public.staff_permissions SET owner_id = _perm WHERE owner_id <> _perm;
  UPDATE public.user_roles SET owner_id = _perm WHERE owner_id <> _perm;
  UPDATE public.studio_settings SET owner_id = _perm WHERE owner_id <> _perm;

  -- Guarantee permanent owner has owner role, and no other owner exists
  DELETE FROM public.user_roles WHERE role = 'owner' AND user_id <> _perm;
  INSERT INTO public.user_roles (user_id, owner_id, role)
    VALUES (_perm, _perm, 'owner')
    ON CONFLICT DO NOTHING;

  -- Delete every other auth user (cascades profiles, user_roles, etc.)
  DELETE FROM auth.users WHERE id <> _perm;
END $$;
