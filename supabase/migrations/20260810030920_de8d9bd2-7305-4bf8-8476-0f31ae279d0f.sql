ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS terms_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_image_url text;

DROP FUNCTION IF EXISTS public.get_default_studio_meta();
CREATE FUNCTION public.get_default_studio_meta()
RETURNS TABLE(owner_id uuid, studio_name text, logo_url text, background_url text, terms_enabled boolean, terms_image_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _perm uuid;
BEGIN
  SELECT ur.user_id INTO _perm FROM public.user_roles ur
   WHERE ur.role = 'owner' ORDER BY ur.created_at ASC LIMIT 1;
  RETURN QUERY
  SELECT s.owner_id, s.studio_name, s.logo_url, s.background_url, s.terms_enabled, s.terms_image_url
    FROM public.studio_settings s WHERE s.owner_id = _perm LIMIT 1;
END;
$$;

DROP FUNCTION IF EXISTS public.get_public_studio_meta(uuid);
CREATE FUNCTION public.get_public_studio_meta(_owner uuid)
RETURNS TABLE(owner_id uuid, studio_name text, logo_url text, background_url text, terms_enabled boolean, terms_image_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id, studio_name, logo_url, background_url, terms_enabled, terms_image_url
  FROM public.studio_settings
  WHERE owner_id = _owner
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_studio_meta() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_studio_meta(uuid) TO anon, authenticated;