
-- Knowledge base
CREATE TABLE public.chatbot_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  question TEXT NOT NULL,
  alternate_questions TEXT[] NOT NULL DEFAULT '{}',
  answer TEXT NOT NULL,
  category TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_knowledge TO authenticated;
GRANT ALL ON public.chatbot_knowledge TO service_role;
ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages KB"
  ON public.chatbot_knowledge FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.get_owner_id(auth.uid()) = owner_id)
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX chatbot_knowledge_owner_idx ON public.chatbot_knowledge(owner_id);

CREATE TRIGGER chatbot_knowledge_updated_at BEFORE UPDATE ON public.chatbot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat history
CREATE TABLE public.chatbot_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  phone TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  matched_kb_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_chat_history TO authenticated;
GRANT ALL ON public.chatbot_chat_history TO service_role;
ALTER TABLE public.chatbot_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views history"
  ON public.chatbot_chat_history FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Owner deletes history"
  ON public.chatbot_chat_history FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE INDEX chatbot_history_owner_idx ON public.chatbot_chat_history(owner_id, created_at DESC);

-- Pending questions
CREATE TABLE public.chatbot_pending_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  phone TEXT,
  question TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  knowledge_id UUID REFERENCES public.chatbot_knowledge(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatbot_pending_questions TO authenticated;
GRANT ALL ON public.chatbot_pending_questions TO service_role;
ALTER TABLE public.chatbot_pending_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages pending"
  ON public.chatbot_pending_questions FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX chatbot_pending_owner_idx ON public.chatbot_pending_questions(owner_id, resolved, created_at DESC);

CREATE TRIGGER chatbot_pending_updated_at BEFORE UPDATE ON public.chatbot_pending_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
