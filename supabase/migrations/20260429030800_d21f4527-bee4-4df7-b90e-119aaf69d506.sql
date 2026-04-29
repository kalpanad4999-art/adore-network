
-- New batches table
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  fee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own batches"
ON public.batches FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_batches_updated_at
BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link customers to a batch
ALTER TABLE public.students ADD COLUMN batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL;
CREATE INDEX idx_students_batch_id ON public.students(batch_id);

-- Remove QR sign-up batches
DROP TABLE IF EXISTS public.registration_batches CASCADE;
