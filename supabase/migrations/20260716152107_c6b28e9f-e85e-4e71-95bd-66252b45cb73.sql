-- RPCs so unauthenticated pages (Auth, PublicStudio) and the browser tab
-- favicon can display the studio's own logo & name without any session.

CREATE OR REPLACE FUNCTION public.get_public_studio_meta(_owner uuid)
RETURNS TABLE(owner_id uuid, studio_name text, logo_url text, background_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id, studio_name, logo_url, background_url
  FROM public.studio_settings
  WHERE owner_id = _owner
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_default_studio_meta()
RETURNS TABLE(owner_id uuid, studio_name text, logo_url text, background_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _perm uuid;
BEGIN
  SELECT id INTO _perm FROM auth.users
   WHERE lower(email) = 'smileychandru150@gmail.com' LIMIT 1;
  IF _perm IS NULL THEN
    SELECT ur.user_id INTO _perm FROM public.user_roles ur
     WHERE ur.role = 'owner' ORDER BY ur.created_at ASC LIMIT 1;
  END IF;
  RETURN QUERY
  SELECT s.owner_id, s.studio_name, s.logo_url, s.background_url
    FROM public.studio_settings s WHERE s.owner_id = _perm LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_studio_meta(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_studio_meta() TO anon, authenticated;