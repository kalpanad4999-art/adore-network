-- Biometric credential storage on existing security table
ALTER TABLE public.studio_security
  ADD COLUMN IF NOT EXISTS webauthn_credential_id text,
  ADD COLUMN IF NOT EXISTS webauthn_enabled boolean NOT NULL DEFAULT false;

-- Audit log for payment & security actions
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.payment_audit_logs TO authenticated;
GRANT ALL ON public.payment_audit_logs TO service_role;

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view their studio audit logs"
  ON public.payment_audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Studio members can insert audit logs"
  ON public.payment_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (auth.uid() = owner_id OR public.get_owner_id(auth.uid()) = owner_id)
  );

CREATE INDEX IF NOT EXISTS payment_audit_logs_owner_created_idx
  ON public.payment_audit_logs (owner_id, created_at DESC);