CREATE TABLE public.insight_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '',
  initial_height numeric,
  present_height numeric,
  initial_weight numeric,
  present_weight numeric,
  initial_flexibility numeric,
  present_flexibility numeric,
  insights text,
  custom_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_comparisons TO authenticated;
GRANT ALL ON public.insight_comparisons TO service_role;

ALTER TABLE public.insight_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view comparisons"
ON public.insight_comparisons FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace members can create comparisons"
ON public.insight_comparisons FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace members can update comparisons"
ON public.insight_comparisons FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace members can delete comparisons"
ON public.insight_comparisons FOR DELETE TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE INDEX idx_insight_comparisons_student ON public.insight_comparisons(user_id, student_id, created_at DESC);

CREATE TRIGGER trg_insight_comparisons_updated
BEFORE UPDATE ON public.insight_comparisons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();