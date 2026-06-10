
-- 1) Payments: remove staff database-level access (PIN gate becomes meaningful)
DROP POLICY IF EXISTS "Staff manages owner payments" ON public.student_payments;

-- 2) Move PIN hashes out of studio_settings (which is workspace-readable) into an owner-only table
CREATE TABLE IF NOT EXISTS public.studio_security (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payments_pin_hash TEXT,
  app_lock_pin_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_security TO authenticated;
GRANT ALL ON public.studio_security TO service_role;

ALTER TABLE public.studio_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own security" ON public.studio_security
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Migrate existing hashes
INSERT INTO public.studio_security (owner_id, payments_pin_hash, app_lock_pin_hash)
SELECT owner_id, payments_pin_hash, app_lock_pin_hash
FROM public.studio_settings
WHERE payments_pin_hash IS NOT NULL OR app_lock_pin_hash IS NOT NULL
ON CONFLICT (owner_id) DO UPDATE SET
  payments_pin_hash = EXCLUDED.payments_pin_hash,
  app_lock_pin_hash = EXCLUDED.app_lock_pin_hash,
  updated_at = now();

ALTER TABLE public.studio_settings DROP COLUMN IF EXISTS payments_pin_hash;
ALTER TABLE public.studio_settings DROP COLUMN IF EXISTS app_lock_pin_hash;

CREATE TRIGGER update_studio_security_updated_at
  BEFORE UPDATE ON public.studio_security
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Make get_owner_id deterministic
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT owner_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'staff'
  ORDER BY created_at ASC, owner_id ASC
  LIMIT 1
$function$;
