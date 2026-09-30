CREATE TABLE public.member_face_enrollments (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  photo_path text NOT NULL,
  provider_face_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.member_face_enrollments TO service_role;
ALTER TABLE public.member_face_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX member_face_enrollments_batch_idx ON public.member_face_enrollments(owner_id, batch_id);
CREATE TRIGGER member_face_enrollments_updated_at BEFORE UPDATE ON public.member_face_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();