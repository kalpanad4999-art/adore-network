-- 1. Harden get_batch_by_token: do NOT leak owner user_id to public
DROP FUNCTION IF EXISTS public.get_batch_by_token(uuid);
CREATE FUNCTION public.get_batch_by_token(_token uuid)
RETURNS TABLE(id uuid, name text, description text, fee numeric, start_date date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, name, description, fee, start_date
  FROM public.batches
  WHERE public_token = _token
  LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO anon, authenticated;

-- 2. Harden get_owner_id: filter to staff role only
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT owner_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'staff'
  LIMIT 1
$function$;

-- 3. Add staff RLS policy for student_payments
DROP POLICY IF EXISTS "Staff manages owner payments" ON public.student_payments;
CREATE POLICY "Staff manages owner payments" ON public.student_payments
FOR ALL TO authenticated
USING (user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = public.get_owner_id(auth.uid()));

-- 4. Validation + anti-abuse on public registration
CREATE OR REPLACE FUNCTION public.register_student_via_token(
  _token uuid, _name text, _email text, _phone text, _address text, _notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _batch RECORD;
  _new_id UUID;
  _name_clean TEXT;
  _email_clean TEXT;
  _phone_clean TEXT;
  _address_clean TEXT;
  _notes_clean TEXT;
BEGIN
  _name_clean := NULLIF(trim(_name), '');
  _email_clean := NULLIF(lower(trim(_email)), '');
  _phone_clean := NULLIF(trim(_phone), '');
  _address_clean := NULLIF(trim(_address), '');
  _notes_clean := NULLIF(trim(_notes), '');

  IF _name_clean IS NULL OR length(_name_clean) < 2 OR length(_name_clean) > 80 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;
  IF _email_clean IS NOT NULL AND (length(_email_clean) > 120 OR _email_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;
  IF _phone_clean IS NOT NULL AND (length(_phone_clean) > 30 OR _phone_clean !~ '^[0-9+\-\s()]+$') THEN
    RAISE EXCEPTION 'Invalid phone';
  END IF;
  IF _address_clean IS NOT NULL AND length(_address_clean) > 300 THEN
    RAISE EXCEPTION 'Address too long';
  END IF;
  IF _notes_clean IS NOT NULL AND length(_notes_clean) > 500 THEN
    RAISE EXCEPTION 'Notes too long';
  END IF;

  SELECT id, user_id INTO _batch FROM public.batches WHERE public_token = _token LIMIT 1;
  IF _batch.id IS NULL THEN
    RAISE EXCEPTION 'Invalid batch link';
  END IF;

  IF _email_clean IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.students
    WHERE batch_id = _batch.id AND lower(email) = _email_clean
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'A registration with this email already exists';
  END IF;
  IF _phone_clean IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.students
    WHERE batch_id = _batch.id AND phone = _phone_clean
      AND created_at > now() - interval '24 hours'
  ) THEN
    RAISE EXCEPTION 'A registration with this phone already exists';
  END IF;

  INSERT INTO public.students (user_id, batch_id, name, email, phone, address, notes)
  VALUES (_batch.user_id, _batch.id, _name_clean, _email_clean, _phone_clean, _address_clean, _notes_clean)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;

-- 5. Tighten studio-backgrounds storage write policies to authenticated only
DROP POLICY IF EXISTS "Owners upload backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Owners update backgrounds" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete backgrounds" ON storage.objects;

CREATE POLICY "Owners upload backgrounds" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'studio-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update backgrounds" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'studio-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete backgrounds" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'studio-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);
