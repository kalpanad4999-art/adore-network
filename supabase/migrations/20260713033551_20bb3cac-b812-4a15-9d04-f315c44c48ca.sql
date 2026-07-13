
-- Attendance module: attendance records + biometric device config

CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- owner (studio)
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent')),
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual','biometric','biometric_sim','device_sync')),
  device_id UUID,
  marked_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
CREATE INDEX attendance_owner_date_idx ON public.attendance(user_id, attendance_date DESC);
CREATE INDEX attendance_batch_date_idx ON public.attendance(batch_id, attendance_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Owners manage attendance"
  ON public.attendance FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

-- Staff with customers or classes permission may view/mark
CREATE POLICY "Staff with permission can insert attendance"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = public.get_owner_id(auth.uid()))
    AND (public.staff_has_permission(auth.uid(), 'customers')
         OR public.staff_has_permission(auth.uid(), 'classes'))
  );

CREATE TRIGGER attendance_set_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Biometric device settings
CREATE TABLE public.biometric_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- owner
  device_name TEXT NOT NULL,
  device_identifier TEXT,
  ip_address TEXT,
  port INTEGER,
  username TEXT,
  password TEXT, -- stored encrypted at rest by supabase; access restricted by RLS
  api_key TEXT,
  connection_type TEXT NOT NULL DEFAULT 'lan' CHECK (connection_type IN ('usb','lan','wifi','bluetooth')),
  auto_sync BOOLEAN NOT NULL DEFAULT false,
  auto_sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (last_status IN ('connected','disconnected','error')),
  last_status_message TEXT,
  last_connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_devices TO authenticated;
GRANT ALL ON public.biometric_devices TO service_role;
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;

-- Only owner can manage devices (sensitive credentials)
CREATE POLICY "Owner manages biometric devices"
  ON public.biometric_devices FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER biometric_devices_set_updated_at
  BEFORE UPDATE ON public.biometric_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
