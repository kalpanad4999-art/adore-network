
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1);

CREATE OR REPLACE FUNCTION public.register_student_via_token(
  _token uuid, _name text, _email text, _phone text, _address text, _notes text,
  _height_cm numeric DEFAULT NULL, _weight_kg numeric DEFAULT NULL
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
  IF _height_cm IS NOT NULL AND (_height_cm < 30 OR _height_cm > 272) THEN
    RAISE EXCEPTION 'Invalid height';
  END IF;
  IF _weight_kg IS NOT NULL AND (_weight_kg < 2 OR _weight_kg > 500) THEN
    RAISE EXCEPTION 'Invalid weight';
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

  INSERT INTO public.students (user_id, batch_id, name, email, phone, address, notes, height_cm, weight_kg)
  VALUES (_batch.user_id, _batch.id, _name_clean, _email_clean, _phone_clean, _address_clean, _notes_clean, _height_cm, _weight_kg)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric) TO anon, authenticated;
