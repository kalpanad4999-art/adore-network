
-- 1. staff_permissions table
CREATE TABLE public.staff_permissions (
  owner_id uuid NOT NULL,
  staff_user_id uuid NOT NULL,
  can_customers boolean NOT NULL DEFAULT true,
  can_gallery boolean NOT NULL DEFAULT true,
  can_classes boolean NOT NULL DEFAULT true,
  can_payments boolean NOT NULL DEFAULT false,
  can_renewals boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- Owner manages their staff permission rows
CREATE POLICY "Owner manages staff perms"
  ON public.staff_permissions FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Staff can read their own row
CREATE POLICY "Staff reads own perms"
  ON public.staff_permissions FOR SELECT
  USING (auth.uid() = staff_user_id);

CREATE TRIGGER update_staff_permissions_updated_at
  BEFORE UPDATE ON public.staff_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Permission helper
CREATE OR REPLACE FUNCTION public.staff_has_permission(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _row public.staff_permissions%ROWTYPE;
BEGIN
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL OR _role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT * INTO _row FROM public.staff_permissions WHERE staff_user_id = _user_id;
  IF NOT FOUND THEN
    -- Grandfather existing staff (no perms row yet) — full access
    RETURN true;
  END IF;

  IF NOT _row.is_active THEN
    RETURN false;
  END IF;

  RETURN CASE _module
    WHEN 'customers' THEN _row.can_customers
    WHEN 'gallery'   THEN _row.can_gallery
    WHEN 'classes'   THEN _row.can_classes
    WHEN 'payments'  THEN _row.can_payments
    WHEN 'renewals'  THEN _row.can_renewals
    ELSE false
  END;
END;
$$;

-- 3. Update staff RLS policies to respect module permissions
-- students / batches: needs customers OR renewals to read; customers to write
DROP POLICY IF EXISTS "Staff manages owner students" ON public.students;
CREATE POLICY "Staff reads owner students"
  ON public.students FOR SELECT
  USING (user_id = get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(),'customers')
      OR public.staff_has_permission(auth.uid(),'renewals')
      OR public.staff_has_permission(auth.uid(),'payments')));
CREATE POLICY "Staff writes owner students"
  ON public.students FOR INSERT
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'));
CREATE POLICY "Staff updates owner students"
  ON public.students FOR UPDATE
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'));
CREATE POLICY "Staff deletes owner students"
  ON public.students FOR DELETE
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'));

DROP POLICY IF EXISTS "Staff manages owner batches" ON public.batches;
CREATE POLICY "Staff reads owner batches"
  ON public.batches FOR SELECT
  USING (user_id = get_owner_id(auth.uid())
    AND (public.staff_has_permission(auth.uid(),'customers')
      OR public.staff_has_permission(auth.uid(),'renewals')));
CREATE POLICY "Staff writes owner batches"
  ON public.batches FOR INSERT
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'));
CREATE POLICY "Staff updates owner batches"
  ON public.batches FOR UPDATE
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'));
CREATE POLICY "Staff deletes owner batches"
  ON public.batches FOR DELETE
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'customers'));

-- gallery_items: requires 'gallery'
DROP POLICY IF EXISTS "Staff manages owner gallery" ON public.gallery_items;
CREATE POLICY "Staff manages owner gallery"
  ON public.gallery_items FOR ALL
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'gallery'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'gallery'));

-- live_classes / recordings: requires 'classes'
DROP POLICY IF EXISTS "Staff manages owner live classes" ON public.live_classes;
CREATE POLICY "Staff manages owner live classes"
  ON public.live_classes FOR ALL
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'classes'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'classes'));

DROP POLICY IF EXISTS "Staff manages owner recordings" ON public.recordings;
CREATE POLICY "Staff manages owner recordings"
  ON public.recordings FOR ALL
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'classes'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'classes'));

-- expenses: requires 'payments'
DROP POLICY IF EXISTS "Staff manages owner expenses" ON public.expenses;
CREATE POLICY "Staff manages owner expenses"
  ON public.expenses FOR ALL
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'));

-- student_payments: add staff policies conditioned on 'payments'
CREATE POLICY "Staff reads owner payments"
  ON public.student_payments FOR SELECT
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'));
CREATE POLICY "Staff inserts owner payments"
  ON public.student_payments FOR INSERT
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'));
CREATE POLICY "Staff updates owner payments"
  ON public.student_payments FOR UPDATE
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'))
  WITH CHECK (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'));
CREATE POLICY "Staff deletes owner payments"
  ON public.student_payments FOR DELETE
  USING (user_id = get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(),'payments'));

-- 4. Allow multiple invitations per owner (drop single-owner uniqueness)
ALTER TABLE public.staff_invitations DROP CONSTRAINT IF EXISTS staff_invitations_owner_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_owner_email_idx
  ON public.staff_invitations (owner_id, lower(email));

-- 5. Seed staff_permissions row when a staff user is created
CREATE OR REPLACE FUNCTION public.handle_new_staff_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'staff' THEN
    INSERT INTO public.staff_permissions (owner_id, staff_user_id)
    VALUES (NEW.owner_id, NEW.user_id)
    ON CONFLICT (staff_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_role_created_staff_perms ON public.user_roles;
CREATE TRIGGER on_user_role_created_staff_perms
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_staff_permissions();
