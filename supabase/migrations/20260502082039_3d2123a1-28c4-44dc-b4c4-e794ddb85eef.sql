ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS required_fields text[] NOT NULL DEFAULT ARRAY['name']::text[];

DROP FUNCTION IF EXISTS public.get_batch_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_batch_by_token(_token uuid)
 RETURNS TABLE(id uuid, name text, description text, fee numeric, start_date date, required_fields text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, name, description, fee, start_date, required_fields
  FROM public.batches
  WHERE public_token = _token
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_batch_by_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO anon, authenticated;