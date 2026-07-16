
-- 1. Add phone field on profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles(phone);

-- 2. Update handle_new_user to persist phone from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$;

-- 3. RPC to look up email by phone (for phone-based login)
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles
  WHERE phone = _phone
     OR regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;

-- 4. Consolidate ownership: promote smileychandru150@gmail.com, demote all other Owners
DO $$
DECLARE
  _new_owner uuid;
  _old_owner uuid;
BEGIN
  SELECT id INTO _new_owner FROM auth.users
   WHERE lower(email) = 'smileychandru150@gmail.com' LIMIT 1;

  IF _new_owner IS NULL THEN
    RAISE NOTICE 'Permanent owner account not found — skipping owner consolidation. It will be applied on first login.';
    RETURN;
  END IF;

  -- Ensure permanent owner has the owner role and studio_settings
  DELETE FROM public.user_roles WHERE user_id = _new_owner;
  INSERT INTO public.user_roles (user_id, owner_id, role) VALUES (_new_owner, _new_owner, 'owner');
  INSERT INTO public.studio_settings (owner_id) VALUES (_new_owner) ON CONFLICT DO NOTHING;

  -- Reassign every other Owner's data to the permanent Owner, then demote them
  FOR _old_owner IN
    SELECT user_id FROM public.user_roles WHERE role = 'owner' AND user_id <> _new_owner
  LOOP
    UPDATE public.students          SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.batches           SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.student_payments  SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.expenses          SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.instructors       SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.locations         SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.gallery_items     SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.recordings        SET user_id = _new_owner WHERE user_id = _old_owner;
    UPDATE public.live_classes      SET user_id = _new_owner WHERE user_id = _old_owner;

    -- attendance / biometric_devices may use owner_id or user_id columns
    BEGIN UPDATE public.attendance         SET user_id  = _new_owner WHERE user_id  = _old_owner; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.attendance         SET owner_id = _new_owner WHERE owner_id = _old_owner; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.biometric_devices  SET user_id  = _new_owner WHERE user_id  = _old_owner; EXCEPTION WHEN undefined_column THEN NULL; END;
    BEGIN UPDATE public.biometric_devices  SET owner_id = _new_owner WHERE owner_id = _old_owner; EXCEPTION WHEN undefined_column THEN NULL; END;

    -- Studio settings/security: keep the permanent owner's, drop the old one's
    DELETE FROM public.studio_settings WHERE owner_id = _old_owner;
    DELETE FROM public.studio_security WHERE owner_id = _old_owner;

    -- Any staff previously under the old owner move under the permanent owner
    UPDATE public.user_roles SET owner_id = _new_owner
     WHERE owner_id = _old_owner AND role = 'staff' AND user_id <> _new_owner;

    -- Demote the old owner to staff under the permanent owner
    DELETE FROM public.user_roles WHERE user_id = _old_owner;
    INSERT INTO public.user_roles (user_id, owner_id, role) VALUES (_old_owner, _new_owner, 'staff');
  END LOOP;
END $$;

-- 5. New registrations always become Staff of the permanent Owner
--    (unless they signed up with the permanent owner email itself)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _perm_owner uuid;
BEGIN
  SELECT id INTO _perm_owner FROM auth.users
   WHERE lower(email) = 'smileychandru150@gmail.com' LIMIT 1;

  -- If this signup IS the permanent owner, make them owner
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
    -- Fallback (permanent owner not yet registered): behave as before
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, NEW.id, 'owner')
      ON CONFLICT DO NOTHING;
    INSERT INTO public.studio_settings (owner_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
