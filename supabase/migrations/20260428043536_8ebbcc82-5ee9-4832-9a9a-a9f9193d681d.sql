CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.student_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'cash',
  plan TEXT NOT NULL DEFAULT 'drop-in',
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own payments"
ON public.student_payments FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owner inserts own payments"
ON public.student_payments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner updates own payments"
ON public.student_payments FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes own payments"
ON public.student_payments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_student_payments_student ON public.student_payments(student_id);
CREATE INDEX idx_student_payments_user ON public.student_payments(user_id);

CREATE TRIGGER update_student_payments_updated_at
BEFORE UPDATE ON public.student_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();