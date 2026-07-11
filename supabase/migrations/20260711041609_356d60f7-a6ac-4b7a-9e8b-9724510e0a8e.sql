
ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expiry_action TEXT NOT NULL DEFAULT 'hide' CHECK (expiry_action IN ('hide','delete'));

CREATE INDEX IF NOT EXISTS gallery_items_expires_at_idx ON public.gallery_items (expires_at) WHERE expires_at IS NOT NULL;

-- Public gallery view: exclude expired items
CREATE OR REPLACE FUNCTION public.get_public_gallery(_owner uuid)
 RETURNS TABLE(id uuid, title text, description text, media_type text, storage_path text, thumbnail_path text, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT id, title, description, media_type, storage_path, thumbnail_path, created_at
  FROM public.gallery_items
  WHERE user_id = _owner AND is_public = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC;
$$;

-- Cleanup function: hide or delete expired gallery items for an owner
CREATE OR REPLACE FUNCTION public.cleanup_expired_gallery(_owner uuid)
 RETURNS TABLE(deleted_paths text[])
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _paths text[];
BEGIN
  IF _owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.gallery_items
  SET is_public = false
  WHERE user_id = _owner
    AND expiry_action = 'hide'
    AND expires_at IS NOT NULL AND expires_at <= now()
    AND is_public = true;

  SELECT COALESCE(array_agg(storage_path), '{}') INTO _paths
  FROM public.gallery_items
  WHERE user_id = _owner
    AND expiry_action = 'delete'
    AND expires_at IS NOT NULL AND expires_at <= now();

  DELETE FROM public.gallery_items
  WHERE user_id = _owner
    AND expiry_action = 'delete'
    AND expires_at IS NOT NULL AND expires_at <= now();

  RETURN QUERY SELECT _paths;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) TO authenticated;
