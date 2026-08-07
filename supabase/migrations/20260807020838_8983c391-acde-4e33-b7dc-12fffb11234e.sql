ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS due_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid';

CREATE OR REPLACE FUNCTION public.student_payments_set_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.due_amount IS NULL OR NEW.due_amount < 0 THEN
    NEW.due_amount := 0;
  END IF;
  NEW.payment_status := CASE WHEN NEW.due_amount > 0 THEN 'partial' ELSE 'paid' END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_payments_status_trg ON public.student_payments;
CREATE TRIGGER student_payments_status_trg
BEFORE INSERT OR UPDATE ON public.student_payments
FOR EACH ROW EXECUTE FUNCTION public.student_payments_set_status();

CREATE OR REPLACE FUNCTION public.get_workspace_owner_info()
RETURNS TABLE(user_id uuid, full_name text, email text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, p.full_name, COALESCE(p.email, u.email)
  FROM public.user_roles r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE r.role = 'owner'
  ORDER BY r.created_at ASC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_workspace_owner_info() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_owner_info() TO authenticated;