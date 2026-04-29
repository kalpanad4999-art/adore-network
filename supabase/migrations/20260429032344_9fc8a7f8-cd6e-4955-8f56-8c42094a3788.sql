-- Add public token to batches
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- Security definer function to resolve a batch by its public token (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_batch_by_token(_token UUID)
RETURNS TABLE(id UUID, user_id UUID, name TEXT, description TEXT, fee NUMERIC, start_date DATE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, name, description, fee, start_date
  FROM public.batches
  WHERE public_token = _token
  LIMIT 1;
$$;

-- Security definer function to register a customer via public token
CREATE OR REPLACE FUNCTION public.register_student_via_token(
  _token UUID,
  _name TEXT,
  _email TEXT,
  _phone TEXT,
  _address TEXT,
  _notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _batch RECORD;
  _new_id UUID;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  SELECT id, user_id INTO _batch FROM public.batches WHERE public_token = _token LIMIT 1;
  IF _batch.id IS NULL THEN
    RAISE EXCEPTION 'Invalid batch link';
  END IF;

  INSERT INTO public.students (user_id, batch_id, name, email, phone, address, notes)
  VALUES (_batch.user_id, _batch.id, trim(_name), NULLIF(trim(_email),''), NULLIF(trim(_phone),''), NULLIF(trim(_address),''), NULLIF(trim(_notes),''))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- Allow anonymous and authenticated users to call these functions
GRANT EXECUTE ON FUNCTION public.get_batch_by_token(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_via_token(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;