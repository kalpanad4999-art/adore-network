ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS can_attendance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_insights boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_offers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_settings boolean NOT NULL DEFAULT true;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid;

CREATE INDEX IF NOT EXISTS students_assigned_staff_idx ON public.students(assigned_staff_id);

-- Module permission lookup, now covering every module.
CREATE OR REPLACE FUNCTION public.staff_has_permission(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _row public.staff_permissions%ROWTYPE;
BEGIN
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;
  IF _role = 'owner' THEN RETURN true; END IF;

  SELECT * INTO _row FROM public.staff_permissions WHERE staff_user_id = _user_id;
  IF NOT FOUND OR NOT _row.is_active THEN RETURN false; END IF;

  RETURN CASE _module
    WHEN 'customers'  THEN _row.can_customers
    WHEN 'gallery'    THEN _row.can_gallery
    WHEN 'classes'    THEN _row.can_classes
    WHEN 'payments'   THEN _row.can_payments
    WHEN 'renewals'   THEN _row.can_renewals
    WHEN 'attendance' THEN _row.can_attendance
    WHEN 'insights'   THEN _row.can_insights
    WHEN 'offers'     THEN _row.can_offers
    WHEN 'settings'   THEN _row.can_settings
    ELSE false
  END;
END;
$function$;

-- Row-level member scoping: owners see all, staff see only assigned members.
CREATE OR REPLACE FUNCTION public.can_access_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _role text;
BEGIN
  SELECT role::text INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;
  IF _role = 'owner' THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.students s
     WHERE s.id = _student_id AND s.assigned_staff_id = _user_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) TO authenticated;

-- Owners can read profiles of everyone in their workspace (staff list).
DROP POLICY IF EXISTS "Owners view workspace profiles" ON public.profiles;
CREATE POLICY "Owners view workspace profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles r
     WHERE r.user_id = profiles.id AND r.owner_id = auth.uid()
  )
);

-- Members: staff only see their assigned members.
DROP POLICY IF EXISTS "Staff reads owner students" ON public.students;
CREATE POLICY "Staff reads owner students" ON public.students
FOR SELECT TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND assigned_staff_id = auth.uid()
  AND (
    public.staff_has_permission(auth.uid(), 'customers')
    OR public.staff_has_permission(auth.uid(), 'renewals')
    OR public.staff_has_permission(auth.uid(), 'payments')
    OR public.staff_has_permission(auth.uid(), 'attendance')
    OR public.staff_has_permission(auth.uid(), 'insights')
  )
);

DROP POLICY IF EXISTS "Staff updates owner students" ON public.students;
CREATE POLICY "Staff updates owner students" ON public.students
FOR UPDATE TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND assigned_staff_id = auth.uid()
  AND public.staff_has_permission(auth.uid(), 'customers')
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
  AND assigned_staff_id = auth.uid()
  AND public.staff_has_permission(auth.uid(), 'customers')
);

DROP POLICY IF EXISTS "Staff deletes owner students" ON public.students;
CREATE POLICY "Staff deletes owner students" ON public.students
FOR DELETE TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND assigned_staff_id = auth.uid()
  AND public.staff_has_permission(auth.uid(), 'customers')
);

-- Payments: staff limited to their assigned members.
DROP POLICY IF EXISTS "Staff reads owner payments" ON public.student_payments;
CREATE POLICY "Staff reads owner payments" ON public.student_payments
FOR SELECT TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'payments')
  AND public.can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff inserts owner payments" ON public.student_payments;
CREATE POLICY "Staff inserts owner payments" ON public.student_payments
FOR INSERT TO authenticated
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'payments')
  AND public.can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff updates owner payments" ON public.student_payments;
CREATE POLICY "Staff updates owner payments" ON public.student_payments
FOR UPDATE TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'payments')
  AND public.can_access_student(auth.uid(), student_id)
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'payments')
  AND public.can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff deletes owner payments" ON public.student_payments;
CREATE POLICY "Staff deletes owner payments" ON public.student_payments
FOR DELETE TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'payments')
  AND public.can_access_student(auth.uid(), student_id)
);

-- Attendance: dedicated permission + assigned members only.
DROP POLICY IF EXISTS "Staff select attendance" ON public.attendance;
CREATE POLICY "Staff select attendance" ON public.attendance
FOR SELECT TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'attendance')
  AND public.can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff insert attendance" ON public.attendance;
CREATE POLICY "Staff insert attendance" ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'attendance')
  AND public.can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff update attendance" ON public.attendance;
CREATE POLICY "Staff update attendance" ON public.attendance
FOR UPDATE TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'attendance')
  AND public.can_access_student(auth.uid(), student_id)
)
WITH CHECK (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'attendance')
  AND public.can_access_student(auth.uid(), student_id)
);

DROP POLICY IF EXISTS "Staff delete attendance" ON public.attendance;
CREATE POLICY "Staff delete attendance" ON public.attendance
FOR DELETE TO authenticated
USING (
  user_id = public.get_owner_id(auth.uid())
  AND public.staff_has_permission(auth.uid(), 'attendance')
  AND public.can_access_student(auth.uid(), student_id)
);

-- Learning insights: owner full access, staff need the Insights module and an assignment.
DROP POLICY IF EXISTS "Workspace can view learning insights" ON public.learning_insights;
DROP POLICY IF EXISTS "Workspace can insert learning insights" ON public.learning_insights;
DROP POLICY IF EXISTS "Workspace can update learning insights" ON public.learning_insights;
DROP POLICY IF EXISTS "Workspace can delete learning insights" ON public.learning_insights;

CREATE POLICY "Workspace can view learning insights" ON public.learning_insights
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (
    user_id = public.get_owner_id(auth.uid())
    AND public.staff_has_permission(auth.uid(), 'insights')
    AND public.can_access_student(auth.uid(), student_id)
  )
);

CREATE POLICY "Workspace can insert learning insights" ON public.learning_insights
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR (
    user_id = public.get_owner_id(auth.uid())
    AND public.staff_has_permission(auth.uid(), 'insights')
    AND public.can_access_student(auth.uid(), student_id)
  )
);

CREATE POLICY "Workspace can update learning insights" ON public.learning_insights
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR (
    user_id = public.get_owner_id(auth.uid())
    AND public.staff_has_permission(auth.uid(), 'insights')
    AND public.can_access_student(auth.uid(), student_id)
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR (
    user_id = public.get_owner_id(auth.uid())
    AND public.staff_has_permission(auth.uid(), 'insights')
    AND public.can_access_student(auth.uid(), student_id)
  )
);

CREATE POLICY "Workspace can delete learning insights" ON public.learning_insights
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR (
    user_id = public.get_owner_id(auth.uid())
    AND public.staff_has_permission(auth.uid(), 'insights')
    AND public.can_access_student(auth.uid(), student_id)
  )
);

-- Existing staff keep their current member access: assign every member with no
-- assignment to nobody (owner-only) but preserve any prior assignment.
UPDATE public.staff_permissions SET can_attendance = can_customers WHERE can_attendance = false;
