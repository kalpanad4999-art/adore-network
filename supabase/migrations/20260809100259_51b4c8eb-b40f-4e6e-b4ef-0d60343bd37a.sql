CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_unique_pending_email
ON public.staff_invitations (owner_id, lower(email))
WHERE accepted_at IS NULL AND revoked_at IS NULL;