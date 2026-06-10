
-- Defense-in-depth: FORCE RLS so even the table owner role must satisfy policies
ALTER TABLE public.student_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.studio_security  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.studio_settings  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invitations FORCE ROW LEVEL SECURITY;

-- Hard-revoke anon from the most sensitive tables (PIN hashes, payments, invitations)
REVOKE ALL ON public.studio_security  FROM anon;
REVOKE ALL ON public.student_payments FROM anon;
REVOKE ALL ON public.staff_invitations FROM anon;
REVOKE ALL ON public.user_roles       FROM anon;
