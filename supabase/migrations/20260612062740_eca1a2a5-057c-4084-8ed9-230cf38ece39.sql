
ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS duration_months integer,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

ALTER TABLE public.student_payments ALTER COLUMN plan DROP NOT NULL;
ALTER TABLE public.student_payments ALTER COLUMN plan DROP DEFAULT;
