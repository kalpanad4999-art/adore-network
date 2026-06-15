ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS duration_value integer,
  ADD COLUMN IF NOT EXISTS duration_unit text CHECK (duration_unit IN ('days','months','years'));

-- Backfill: existing rows with duration_months become months-based
UPDATE public.student_payments
  SET duration_value = duration_months, duration_unit = 'months'
  WHERE duration_value IS NULL AND duration_months IS NOT NULL;