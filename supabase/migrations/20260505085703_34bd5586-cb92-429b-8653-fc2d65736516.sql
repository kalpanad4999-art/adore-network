
-- 1. Lock down internal SECURITY DEFINER functions (revoke execute from anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Public-facing RPCs intended for anon: keep, but make explicit
GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_gallery(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_recordings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_live_classes(uuid) TO anon, authenticated;

-- 2. Storage: drop any broad SELECT policies on public buckets that allow listing.
-- Keep file URLs publicly readable (bucket public=true grants direct URL access),
-- but disallow listing via storage.objects SELECT.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (qual ILIKE '%studio-logos%' OR qual ILIKE '%studio-backgrounds%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 3. Studio settings: extra lock methods
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS payments_password_hash text,
  ADD COLUMN IF NOT EXISTS payments_security_question text,
  ADD COLUMN IF NOT EXISTS payments_security_answer_hash text,
  ADD COLUMN IF NOT EXISTS payments_biometric_credential_id text,
  ADD COLUMN IF NOT EXISTS payments_biometric_public_key text;

-- 4. Encrypted notes column on student_payments (client-side encrypted blob)
ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS notes_encrypted text;
