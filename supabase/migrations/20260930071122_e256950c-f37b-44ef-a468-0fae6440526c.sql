REVOKE ALL ON public.member_face_enrollments FROM anon, authenticated;
GRANT ALL ON public.member_face_enrollments TO service_role;