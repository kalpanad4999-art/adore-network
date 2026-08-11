-- 1) Public batch lookup also returns the studio owner so forms can load that studio's terms
DROP FUNCTION IF EXISTS public.get_batch_by_token(uuid);
CREATE FUNCTION public.get_batch_by_token(_token uuid)
RETURNS TABLE(id uuid, user_id uuid, name text, description text, fee numeric, start_date date, required_fields text[], custom_fields jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, name, description, fee, start_date, required_fields, custom_fields
  FROM public.batches WHERE public_token = _token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO anon, authenticated;

-- 2) Replace all registration overloads with a single version that enforces terms server-side
DROP FUNCTION IF EXISTS public.register_student_via_token(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric);
DROP FUNCTION IF EXISTS public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric, jsonb);

CREATE FUNCTION public.register_student_via_token(
  _token uuid,
  _name text,
  _email text,
  _phone text,
  _address text,
  _notes text,
  _height_cm numeric DEFAULT NULL::numeric,
  _weight_kg numeric DEFAULT NULL::numeric,
  _custom_data jsonb DEFAULT '{}'::jsonb,
  _terms_agreed boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch RECORD; _new_id UUID;
  _name_clean TEXT; _email_clean TEXT; _phone_clean TEXT; _address_clean TEXT; _notes_clean TEXT;
  _cf jsonb; _field jsonb; _fname text; _fid text; _fval text;
  _terms_required boolean;
BEGIN
  _name_clean := NULLIF(trim(_name), '');
  _email_clean := NULLIF(lower(trim(_email)), '');
  _phone_clean := NULLIF(trim(_phone), '');
  _address_clean := NULLIF(trim(_address), '');
  _notes_clean := NULLIF(trim(_notes), '');

  IF _name_clean IS NULL OR length(_name_clean) < 2 OR length(_name_clean) > 80 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _email_clean IS NOT NULL AND (length(_email_clean) > 120 OR _email_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF _phone_clean IS NOT NULL AND (length(_phone_clean) > 30 OR _phone_clean !~ '^[0-9+\-\s()]+$') THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF _address_clean IS NOT NULL AND length(_address_clean) > 300 THEN RAISE EXCEPTION 'Address too long'; END IF;
  IF _notes_clean IS NOT NULL AND length(_notes_clean) > 500 THEN RAISE EXCEPTION 'Notes too long'; END IF;
  IF _height_cm IS NOT NULL AND (_height_cm < 30 OR _height_cm > 272) THEN RAISE EXCEPTION 'Invalid height'; END IF;
  IF _weight_kg IS NOT NULL AND (_weight_kg < 2 OR _weight_kg > 500) THEN RAISE EXCEPTION 'Invalid weight'; END IF;

  SELECT id, user_id, custom_fields INTO _batch FROM public.batches WHERE public_token = _token LIMIT 1;
  IF _batch.id IS NULL THEN RAISE EXCEPTION 'Invalid batch link'; END IF;

  -- Server-side Terms & Conditions enforcement: when the studio has terms enabled
  -- with an uploaded image, the registration must include the agreement.
  SELECT (COALESCE(s.terms_enabled, false) AND s.terms_image_url IS NOT NULL)
    INTO _terms_required
    FROM public.studio_settings s
   WHERE s.owner_id = _batch.user_id;
  IF COALESCE(_terms_required, false) AND NOT COALESCE(_terms_agreed, false) THEN
    RAISE EXCEPTION 'You must agree to the Terms & Conditions to register';
  END IF;

  _cf := COALESCE(_batch.custom_fields, '[]'::jsonb);
  FOR _field IN SELECT * FROM jsonb_array_elements(_cf) LOOP
    IF COALESCE((_field->>'enabled')::boolean, true) AND COALESCE((_field->>'required')::boolean, false) THEN
      _fid := _field->>'id';
      _fname := _field->>'name';
      _fval := NULLIF(trim(COALESCE(_custom_data->>_fid, '')), '');
      IF _fval IS NULL THEN RAISE EXCEPTION '% is required', _fname; END IF;
    END IF;
  END LOOP;

  IF _email_clean IS NOT NULL AND EXISTS (SELECT 1 FROM public.students WHERE batch_id = _batch.id AND lower(email) = _email_clean AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'A registration with this email already exists';
  END IF;
  IF _phone_clean IS NOT NULL AND EXISTS (SELECT 1 FROM public.students WHERE batch_id = _batch.id AND phone = _phone_clean AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'A registration with this phone already exists';
  END IF;

  INSERT INTO public.students (user_id, batch_id, name, email, phone, address, notes, height_cm, weight_kg, custom_data)
  VALUES (_batch.user_id, _batch.id, _name_clean, _email_clean, _phone_clean, _address_clean, _notes_clean, _height_cm, _weight_kg, COALESCE(_custom_data, '{}'::jsonb))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric, jsonb, boolean) TO anon, authenticated;