CREATE TABLE public.learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  initial_height numeric,
  present_height numeric,
  initial_weight numeric,
  present_weight numeric,
  initial_flexibility numeric,
  present_flexibility numeric,
  insights text,
  custom_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_insights TO authenticated;
GRANT ALL ON public.learning_insights TO service_role;

ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can view learning insights"
ON public.learning_insights FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace can insert learning insights"
ON public.learning_insights FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace can update learning insights"
ON public.learning_insights FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace can delete learning insights"
ON public.learning_insights FOR DELETE TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE TRIGGER update_learning_insights_updated_at
BEFORE UPDATE ON public.learning_insights
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();