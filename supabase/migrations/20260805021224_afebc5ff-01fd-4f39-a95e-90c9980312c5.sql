CREATE TABLE public.insight_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  unit text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_fields TO authenticated;
GRANT ALL ON public.insight_fields TO service_role;

ALTER TABLE public.insight_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace can view insight fields"
ON public.insight_fields FOR SELECT TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace can insert insight fields"
ON public.insight_fields FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace can update insight fields"
ON public.insight_fields FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()))
WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "Workspace can delete insight fields"
ON public.insight_fields FOR DELETE TO authenticated
USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

CREATE TRIGGER trg_insight_fields_updated
BEFORE UPDATE ON public.insight_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.learning_insights
  ADD COLUMN IF NOT EXISTS custom_measures jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP TABLE IF EXISTS public.insight_comparisons;