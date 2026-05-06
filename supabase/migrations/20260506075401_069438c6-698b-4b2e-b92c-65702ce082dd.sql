ALTER TABLE public.studio_settings
  DROP COLUMN IF EXISTS payments_password_hash,
  DROP COLUMN IF EXISTS payments_security_question,
  DROP COLUMN IF EXISTS payments_security_answer_hash,
  DROP COLUMN IF EXISTS payments_biometric_credential_id,
  DROP COLUMN IF EXISTS payments_biometric_public_key;

ALTER TABLE public.student_payments
  DROP COLUMN IF EXISTS notes_encrypted;