
-- 1. Privilege escalation fix: lock down user_roles writes
-- Only allow inserts/updates/deletes when the user is acting on their own row
-- AND owner_id equals their own auth.uid (i.e. self-owner only).
-- The trigger handle_new_user_role uses SECURITY DEFINER and bypasses RLS so signups still work.

CREATE POLICY "Users cannot insert roles directly"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Users cannot update roles directly"
ON public.user_roles FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "Users cannot delete roles directly"
ON public.user_roles FOR DELETE TO authenticated
USING (false);

-- Prevent multiple role rows for one user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_unique'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 2. Restrict storage buckets: require auth to read/list logos and backgrounds
-- Drop existing broad-public select policies and replace with authenticated-only
DROP POLICY IF EXISTS "Logos are public" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read logos" ON storage.objects;
DROP POLICY IF EXISTS "Backgrounds are public" ON storage.objects;
DROP POLICY IF EXISTS "Backgrounds readable by authenticated" ON storage.objects;

CREATE POLICY "Logos readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-logos');

CREATE POLICY "Backgrounds readable by authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-backgrounds');

-- Keep buckets technically "public" so getPublicUrl format works,
-- but RLS above restricts actual SELECT/LIST to authenticated users.

-- 3. Lock down SECURITY DEFINER helper functions: revoke from anon
REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Trigger functions don't need EXECUTE from clients
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon, public, authenticated;

-- get_batch_by_token and register_student_via_token are intentionally public for /join flow
-- (no change required)
