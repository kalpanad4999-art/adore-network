-- 1) Storage: honour expiry/archival for public gallery + recording files
DROP POLICY IF EXISTS "Public reads public gallery files" ON storage.objects;
CREATE POLICY "Public reads public gallery files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'studio-gallery'
  AND EXISTS (
    SELECT 1 FROM public.gallery_items g
    WHERE (g.storage_path = storage.objects.name OR g.thumbnail_path = storage.objects.name)
      AND g.is_public = true
      AND (g.expires_at IS NULL OR g.expires_at > now())
  )
);

DROP POLICY IF EXISTS "Public reads public recording files" ON storage.objects;
CREATE POLICY "Public reads public recording files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'studio-recordings'
  AND EXISTS (
    SELECT 1 FROM public.recordings r
    WHERE r.storage_path = storage.objects.name
      AND r.is_public = true
      AND r.archived_at IS NULL
      AND (r.publish_at IS NULL OR r.publish_at <= now())
      AND (r.expires_at IS NULL OR r.expires_at > now())
  )
);

-- 2) Lock down SECURITY DEFINER functions: revoke everything, then re-grant only
--    the routines the app actually calls from the client.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- Public (unauthenticated) surface: public studio pages, join links, invite preview
GRANT EXECUTE ON FUNCTION public.get_public_studio_meta(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_studio_meta() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_gallery(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_live_classes(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_recordings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recording_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric, jsonb, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO anon, authenticated;

-- Signed-in surface only
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_workspace_owner_info() TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_live_class_lifecycle() TO authenticated;