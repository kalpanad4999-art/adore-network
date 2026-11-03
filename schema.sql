-- TRINETRA YOGA consolidated schema reference; generated 2026-11-03.

-- SOURCE: 70 migration files; NOT a migration, backup, or verified restore script.

-- No SQL was executed. Never apply this file to the existing database.

-- Managed auth/storage schemas, roles and publication must already exist.

-- Missing settings constraints / inherited ACLs are documented in schema-audit.md.

-- Function bodies are preserved exactly; historical data mutations are excluded.

SET search_path = public, extensions;


-- Enums

CREATE TYPE public.app_role AS ENUM ('owner', 'staff');

CREATE TYPE public.offer_type AS ENUM ('birthday', 'festival', 'new_year', 'annual', 'custom');


-- Table public.profiles; source: 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY ;


-- Table public.locations; source: 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  phone text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY ;


-- Table public.instructors; source: 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE TABLE public.instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  specialization text,
  compensation_type text NOT NULL DEFAULT 'percentage',
  compensation_value numeric(10, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.instructors FROM anon;

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY ;


-- Table public.students; source: 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  membership_type text DEFAULT 'drop-in',
  membership_status text DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  address text,
  batch_id uuid,
  height_cm numeric(5, 1),
  weight_kg numeric(5, 1),
  custom_data jsonb NOT NULL DEFAULT CAST('{}' AS jsonb),
  assigned_staff_id uuid,
  photo_path text
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY ;


-- Table public.expenses; source: 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location_id uuid,
  category text NOT NULL,
  description text,
  amount numeric(10, 2) NOT NULL,
  date date NOT NULL,
  is_recurring boolean DEFAULT FALSE,
  receipt_url text,
  tax_deductible boolean DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY ;


-- Table public.user_roles; source: 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role),
  CONSTRAINT user_roles_user_id_unique UNIQUE (user_id)
);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_roles FROM anon;

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY ;


-- Table public.staff_invitations; source: 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE TABLE public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email text NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT now() + CAST('7 days' AS interval),
  revoked_at timestamptz,
  accepted_by uuid
);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.staff_invitations FROM anon;

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY ;


-- Table public.studio_settings; source: 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE TABLE public.studio_settings (
  owner_id uuid PRIMARY KEY,
  studio_name text NOT NULL DEFAULT 'TRINETRA YOGA',
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  background_url text,
  terms_enabled boolean NOT NULL DEFAULT FALSE,
  terms_image_url text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_settings TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.studio_settings TO service_role;

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY ;


-- Table public.student_payments; source: 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE TABLE public.student_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL DEFAULT 'cash',
  plan text,
  valid_until date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  duration_months integer,
  reminder_sent_at timestamptz,
  duration_value integer,
  duration_unit text CHECK (duration_unit IN ('days', 'months', 'years')),
  applied_offer_id uuid,
  applied_offer_name text,
  applied_offer_type text,
  applied_coupon_code text,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  due_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'paid'
);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.student_payments FROM anon;

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.student_payments ENABLE ROW LEVEL SECURITY ;


-- Table public.batches; source: 20260429030800_d21f4527-bee4-4df7-b90e-119aaf69d506.sql

CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  start_date date,
  fee numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  public_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  required_fields text[] NOT NULL DEFAULT CAST(ARRAY['name'] AS text[]),
  custom_fields jsonb NOT NULL DEFAULT CAST('[]' AS jsonb)
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY ;


-- Table public.gallery_items; source: 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE TABLE public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  description text,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  storage_path text NOT NULL,
  thumbnail_path text,
  is_public boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  expiry_action text NOT NULL DEFAULT 'hide' CHECK (expiry_action IN ('hide', 'delete'))
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY ;


-- Table public.recordings; source: 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE TABLE public.recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  storage_path text,
  external_url text,
  duration_minutes integer,
  recorded_on date,
  is_public boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  public_slug text UNIQUE,
  publish_at timestamptz,
  expires_at timestamptz,
  archived_at timestamptz,
  source_live_class_id uuid
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY ;


-- Table public.live_classes; source: 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE TABLE public.live_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  meeting_url text NOT NULL,
  platform text,
  is_public boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  auto_convert_to_recording boolean NOT NULL DEFAULT FALSE,
  recording_visibility text NOT NULL DEFAULT 'immediate',
  recording_publish_delay_minutes integer,
  recording_hide_after_days integer,
  converted_recording_id uuid,
  converted_at timestamptz
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY ;


-- Table public.studio_security; source: 20260610142421_c158bc3e-64b1-44fc-b47d-eb769d886b4a.sql

CREATE TABLE public.studio_security (
  owner_id uuid PRIMARY KEY,
  payments_pin_hash text,
  app_lock_pin_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  webauthn_credential_id text,
  webauthn_enabled boolean NOT NULL DEFAULT FALSE
);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.studio_security FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.studio_security TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.studio_security TO service_role;

ALTER TABLE public.studio_security ENABLE ROW LEVEL SECURITY ;


-- Table public.payment_audit_logs; source: 20260613035336_ded3f24f-f026-4955-9b69-713357e1215c.sql

CREATE TABLE public.payment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT CAST('{}' AS jsonb),
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON TABLE public.payment_audit_logs TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payment_audit_logs TO service_role;

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY ;


-- Table public.chatbot_knowledge; source: 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE TABLE public.chatbot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  question text NOT NULL,
  alternate_questions text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  category text,
  keywords text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chatbot_knowledge TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.chatbot_knowledge TO service_role;

ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY ;


-- Table public.chatbot_chat_history; source: 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE TABLE public.chatbot_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  phone text,
  question text NOT NULL,
  answer text NOT NULL,
  matched_kb_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chatbot_chat_history TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.chatbot_chat_history TO service_role;

ALTER TABLE public.chatbot_chat_history ENABLE ROW LEVEL SECURITY ;


-- Table public.chatbot_pending_questions; source: 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE TABLE public.chatbot_pending_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  phone text,
  question text NOT NULL,
  resolved boolean NOT NULL DEFAULT FALSE,
  knowledge_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chatbot_pending_questions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.chatbot_pending_questions TO service_role;

ALTER TABLE public.chatbot_pending_questions ENABLE ROW LEVEL SECURITY ;


-- Table public.staff_permissions; source: 20260705121907_688d6695-0bfe-47c8-994c-ec1cb8d25c4d.sql

CREATE TABLE public.staff_permissions (
  owner_id uuid NOT NULL,
  staff_user_id uuid NOT NULL,
  can_customers boolean NOT NULL DEFAULT FALSE,
  can_gallery boolean NOT NULL DEFAULT FALSE,
  can_classes boolean NOT NULL DEFAULT FALSE,
  can_payments boolean NOT NULL DEFAULT FALSE,
  can_renewals boolean NOT NULL DEFAULT FALSE,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_user_id),
  can_attendance boolean NOT NULL DEFAULT FALSE,
  can_insights boolean NOT NULL DEFAULT FALSE,
  can_offers boolean NOT NULL DEFAULT FALSE,
  can_settings boolean NOT NULL DEFAULT TRUE
);

-- Four permission defaults use reported backend false values, overriding migration-era true defaults; see audit.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_permissions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.staff_permissions TO service_role;

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY ;


-- Table public.attendance; source: 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  student_id uuid NOT NULL,
  attendance_date date NOT NULL DEFAULT CAST(pg_catalog.timezone('utc', now()) AS date),
  marked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  method text NOT NULL DEFAULT 'manual',
  device_id uuid,
  marked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date),
  CONSTRAINT attendance_method_check CHECK (method IN ('manual', 'biometric', 'biometric_sim', 'device_sync', 'ai_photo'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.attendance TO service_role;

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY ;


-- Table public.biometric_devices; source: 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE TABLE public.biometric_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_name text NOT NULL,
  device_identifier text,
  ip_address text,
  port integer,
  username text,
  password text,
  api_key text,
  connection_type text NOT NULL DEFAULT 'lan' CHECK (connection_type IN ('usb', 'lan', 'wifi', 'bluetooth')),
  auto_sync boolean NOT NULL DEFAULT FALSE,
  auto_sync_interval_minutes integer NOT NULL DEFAULT 15,
  is_active boolean NOT NULL DEFAULT TRUE,
  last_status text NOT NULL DEFAULT 'disconnected' CHECK (last_status IN ('connected', 'disconnected', 'error')),
  last_status_message text,
  last_connected_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.biometric_devices TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.biometric_devices TO service_role;

ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY ;


-- Table public.offers; source: 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  offer_type public.offer_type NOT NULL DEFAULT 'custom',
  message text,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  min_payment_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (min_payment_amount >= 0),
  valid_from date,
  valid_to date,
  usage_limit_total integer,
  usage_limit_per_member integer,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT TRUE,
  conditions jsonb NOT NULL DEFAULT CAST('{}' AS jsonb),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY ;


-- Table public.coupons; source: 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  code text NOT NULL,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.coupons TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY ;


-- Table public.offer_redemptions; source: 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE TABLE public.offer_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid NOT NULL,
  coupon_id uuid,
  student_id uuid,
  payment_id uuid,
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_redemptions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.offer_redemptions TO service_role;

ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY ;


-- Table public.learning_insights; source: 20260803051338_d7158cb2-98b7-4a44-a150-90e9de2d2aff.sql

CREATE TABLE public.learning_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  batch_id uuid,
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
  UNIQUE (student_id),
  custom_measures jsonb NOT NULL DEFAULT CAST('{}' AS jsonb)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.learning_insights TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.learning_insights TO service_role;

ALTER TABLE public.learning_insights ENABLE ROW LEVEL SECURITY ;


-- Table public.insight_fields; source: 20260805021224_afebc5ff-01fd-4f39-a95e-90c9980312c5.sql

CREATE TABLE public.insight_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  unit text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.insight_fields TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.insight_fields TO service_role;

ALTER TABLE public.insight_fields ENABLE ROW LEVEL SECURITY ;


-- Table public.member_face_enrollments; source: 20260930065512_3209e928-8339-46f2-864a-39211ae0a359.sql

CREATE TABLE public.member_face_enrollments (
  student_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  photo_path text NOT NULL,
  provider_face_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  descriptor real[]
);

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.member_face_enrollments FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_face_enrollments TO authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.member_face_enrollments FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.member_face_enrollments TO service_role;

ALTER TABLE public.member_face_enrollments ENABLE ROW LEVEL SECURITY ;


-- Table public.settings; source: backend schema metadata; PARTIAL, constraints unknown

-- WARNING: creation absent from migrations. PK/FK/index/ACL details unverified; column-only definition.

CREATE TABLE public.settings (
  id uuid NOT NULL,
  username text,
  email text,
  updated_at timestamp DEFAULT now(),
  studio_name text
);

-- UNRESOLVED: no table GRANT recorded in migrations; confirm actual ACLs before use.

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY ;


-- Relationships (deferred until every table exists)

ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.locations ADD CONSTRAINT locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.instructors ADD CONSTRAINT instructors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.students ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.students ADD CONSTRAINT students_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches (id) ON DELETE SET NULL;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.expenses ADD CONSTRAINT expenses_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations (id) ON DELETE SET NULL;

ALTER TABLE public.student_payments ADD CONSTRAINT student_payments_applied_offer_id_fkey FOREIGN KEY (applied_offer_id) REFERENCES public.offers (id) ON DELETE SET NULL;

ALTER TABLE public.student_payments ADD CONSTRAINT student_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;

ALTER TABLE public.recordings ADD CONSTRAINT recordings_source_live_class_id_fkey FOREIGN KEY (source_live_class_id) REFERENCES public.live_classes (id) ON DELETE SET NULL;

ALTER TABLE public.studio_security ADD CONSTRAINT studio_security_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.chatbot_pending_questions ADD CONSTRAINT chatbot_pending_questions_knowledge_id_fkey FOREIGN KEY (knowledge_id) REFERENCES public.chatbot_knowledge (id) ON DELETE SET NULL;

ALTER TABLE public.attendance ADD CONSTRAINT attendance_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches (id) ON DELETE CASCADE;

ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;

ALTER TABLE public.coupons ADD CONSTRAINT coupons_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers (id) ON DELETE CASCADE;

ALTER TABLE public.offer_redemptions ADD CONSTRAINT offer_redemptions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers (id) ON DELETE CASCADE;

ALTER TABLE public.offer_redemptions ADD CONSTRAINT offer_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons (id) ON DELETE SET NULL;

ALTER TABLE public.learning_insights ADD CONSTRAINT learning_insights_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;

ALTER TABLE public.learning_insights ADD CONSTRAINT learning_insights_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches (id) ON DELETE SET NULL;

ALTER TABLE public.member_face_enrollments ADD CONSTRAINT member_face_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id) ON DELETE CASCADE;

ALTER TABLE public.member_face_enrollments ADD CONSTRAINT member_face_enrollments_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.batches (id) ON DELETE CASCADE;


-- Explicit indexes (constraint-backed indexes are created by constraints)

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE INDEX idx_student_payments_student ON public.student_payments (student_id);

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE INDEX idx_student_payments_user ON public.student_payments (user_id);

-- 20260429030800_d21f4527-bee4-4df7-b90e-119aaf69d506.sql

CREATE INDEX idx_students_batch_id ON public.students (batch_id);

-- 20260613035336_ded3f24f-f026-4955-9b69-713357e1215c.sql

CREATE INDEX IF NOT EXISTS payment_audit_logs_owner_created_idx ON public.payment_audit_logs (owner_id, created_at DESC);

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE INDEX chatbot_knowledge_owner_idx ON public.chatbot_knowledge (owner_id);

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE INDEX chatbot_history_owner_idx ON public.chatbot_chat_history (owner_id, created_at DESC);

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE INDEX chatbot_pending_owner_idx ON public.chatbot_pending_questions (owner_id, resolved, created_at DESC);

-- 20260705121907_688d6695-0bfe-47c8-994c-ec1cb8d25c4d.sql

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_owner_email_idx ON public.staff_invitations (owner_id, (lower(email)));

-- 20260711041609_356d60f7-a6ac-4b7a-9e8b-9724510e0a8e.sql

CREATE INDEX IF NOT EXISTS gallery_items_expires_at_idx ON public.gallery_items (expires_at) WHERE expires_at IS NOT NULL;

-- 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE INDEX attendance_owner_date_idx ON public.attendance (user_id, attendance_date DESC);

-- 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE INDEX attendance_batch_date_idx ON public.attendance (batch_id, attendance_date DESC);

-- 20260716144616_a3b5eb8b-0183-4b94-a94d-5f296923a6c5.sql

CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles (phone);

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE INDEX offers_user_active_idx ON public.offers (user_id, is_active);

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE UNIQUE INDEX coupons_user_code_uidx ON public.coupons (user_id, (upper(code)));

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE INDEX offer_redemptions_offer_idx ON public.offer_redemptions (offer_id);

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE INDEX offer_redemptions_payment_idx ON public.offer_redemptions (payment_id);

-- 20260806143015_8ca16608-3f90-401c-9760-a5a2cde0cfd8.sql

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_token_key ON public.staff_invitations (token);

-- 20260806143015_8ca16608-3f90-401c-9760-a5a2cde0cfd8.sql

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_key ON public.user_roles (user_id);

-- 20260809100259_51b4c8eb-b40f-4e6e-b4ef-0d60343bd37a.sql

CREATE UNIQUE INDEX IF NOT EXISTS staff_invitations_unique_pending_email ON public.staff_invitations (owner_id, (lower(email))) WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE INDEX IF NOT EXISTS students_assigned_staff_idx ON public.students (assigned_staff_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_chatbot_pending_knowledge ON public.chatbot_pending_questions (knowledge_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_expenses_location ON public.expenses (location_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses (user_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_instructors_user ON public.instructors (user_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_locations_user ON public.locations (user_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_students_user ON public.students (user_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_recordings_source_live_class ON public.recordings (source_live_class_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_coupons_offer ON public.coupons (offer_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_offer_redemptions_coupon ON public.offer_redemptions (coupon_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_offer_redemptions_offer ON public.offer_redemptions (offer_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_student_payments_applied_offer ON public.student_payments (applied_offer_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_learning_insights_batch ON public.learning_insights (batch_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_gallery_items_user ON public.gallery_items (user_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_recordings_user ON public.recordings (user_id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE INDEX IF NOT EXISTS idx_live_classes_user ON public.live_classes (user_id);

-- 20260930065512_3209e928-8339-46f2-864a-39211ae0a359.sql

CREATE INDEX member_face_enrollments_batch_idx ON public.member_face_enrollments (owner_id, batch_id);


-- Final function definitions

-- 20260716144616_a3b5eb8b-0183-4b94-a94d-5f296923a6c5.sql

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
  RETURN NEW;
END;
$$;

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 20260610142421_c158bc3e-64b1-44fc-b47d-eb769d886b4a.sql

CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT owner_id FROM public.user_roles
  WHERE user_id = _user_id AND role = 'staff'
  ORDER BY created_at ASC, owner_id ASC
  LIMIT 1
$$;

-- 20260806143015_8ca16608-3f90-401c-9760-a5a2cde0cfd8.sql

CREATE OR REPLACE FUNCTION public.handle_new_user_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _owner uuid;
  _invite RECORD;
BEGIN
  SELECT user_id INTO _owner FROM public.user_roles
   WHERE role = 'owner' ORDER BY created_at ASC LIMIT 1;

  -- Bootstrap: the very first account in an empty workspace becomes Owner.
  IF _owner IS NULL THEN
    INSERT INTO public.user_roles (user_id, owner_id, role)
      VALUES (NEW.id, NEW.id, 'owner') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.studio_settings (owner_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Otherwise: only a pending, unexpired invitation grants a Staff account.
  SELECT * INTO _invite FROM public.staff_invitations
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;

  IF _invite.id IS NULL THEN
    RETURN NEW; -- no role => "not authorized"
  END IF;

  INSERT INTO public.user_roles (user_id, owner_id, role)
    VALUES (NEW.id, _invite.owner_id, 'staff')
    ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.staff_invitations
     SET accepted_at = now(), accepted_by = NEW.id
   WHERE id = _invite.id;

  RETURN NEW;
END;
$$;

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

-- 20260711041609_356d60f7-a6ac-4b7a-9e8b-9724510e0a8e.sql

CREATE OR REPLACE FUNCTION public.get_public_gallery(_owner uuid) RETURNS TABLE (id uuid, title text, description text, media_type text, storage_path text, thumbnail_path text, created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, description, media_type, storage_path, thumbnail_path, created_at
  FROM public.gallery_items
  WHERE user_id = _owner AND is_public = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC;
$$;

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE OR REPLACE FUNCTION public.get_public_live_classes(_owner uuid) RETURNS TABLE (id uuid, title text, description text, scheduled_at timestamptz, duration_minutes integer, meeting_url text, platform text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, description, scheduled_at, duration_minutes, meeting_url, platform
  FROM public.live_classes WHERE user_id = _owner AND is_public = true AND scheduled_at >= now() - interval '2 hours'
  ORDER BY scheduled_at ASC;
$$;

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE OR REPLACE FUNCTION public.staff_has_permission(_user_id uuid, _module text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;

-- 20260705121907_688d6695-0bfe-47c8-994c-ec1cb8d25c4d.sql

CREATE OR REPLACE FUNCTION public.handle_new_staff_permissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role = 'staff' THEN
    INSERT INTO public.staff_permissions (owner_id, staff_user_id)
    VALUES (NEW.owner_id, NEW.user_id)
    ON CONFLICT (staff_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- 20260711041609_356d60f7-a6ac-4b7a-9e8b-9724510e0a8e.sql

CREATE OR REPLACE FUNCTION public.cleanup_expired_gallery(_owner uuid) RETURNS TABLE (deleted_paths text[]) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _paths text[];
BEGIN
  IF _owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.gallery_items
  SET is_public = false
  WHERE user_id = _owner
    AND expiry_action = 'hide'
    AND expires_at IS NOT NULL AND expires_at <= now()
    AND is_public = true;

  SELECT COALESCE(array_agg(storage_path), '{}') INTO _paths
  FROM public.gallery_items
  WHERE user_id = _owner
    AND expiry_action = 'delete'
    AND expires_at IS NOT NULL AND expires_at <= now();

  DELETE FROM public.gallery_items
  WHERE user_id = _owner
    AND expiry_action = 'delete'
    AND expires_at IS NOT NULL AND expires_at <= now();

  RETURN QUERY SELECT _paths;
END;
$$;

-- 20260711044616_4057ba1d-588c-41ff-9368-9d2900658e53.sql

CREATE OR REPLACE FUNCTION public.recordings_set_slug() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.public_slug IS NULL THEN
    NEW.public_slug := replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '+',''), '/',''), '=','');
  END IF;
  RETURN NEW;
END;
$$;

-- 20260711044616_4057ba1d-588c-41ff-9368-9d2900658e53.sql

CREATE FUNCTION public.get_public_recordings(_owner uuid) RETURNS TABLE (id uuid, title text, description text, storage_path text, external_url text, duration_minutes integer, recorded_on date, created_at timestamp with time zone, public_slug text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, title, description, storage_path, external_url, duration_minutes, recorded_on, created_at, public_slug
  FROM public.recordings
  WHERE user_id = _owner AND is_public = true
    AND archived_at IS NULL
    AND (publish_at IS NULL OR publish_at <= now())
  ORDER BY recorded_on DESC NULLS LAST, created_at DESC;
$$;

-- 20260711044616_4057ba1d-588c-41ff-9368-9d2900658e53.sql

CREATE OR REPLACE FUNCTION public.get_recording_by_slug(_slug text) RETURNS TABLE (id uuid, user_id uuid, title text, description text, storage_path text, external_url text, duration_minutes integer, recorded_on date, created_at timestamp with time zone) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, user_id, title, description, storage_path, external_url, duration_minutes, recorded_on, created_at
  FROM public.recordings
  WHERE public_slug = _slug
    AND is_public = true
    AND archived_at IS NULL
    AND (publish_at IS NULL OR publish_at <= now());
$$;

-- 20260711044616_4057ba1d-588c-41ff-9368-9d2900658e53.sql

CREATE OR REPLACE FUNCTION public.process_live_class_lifecycle() RETURNS TABLE (converted integer, archived integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _lc RECORD;
  _new_rec_id uuid;
  _publish_at timestamptz;
  _expires_at timestamptz;
  _converted int := 0;
  _archived int := 0;
BEGIN
  FOR _lc IN
    SELECT * FROM public.live_classes
    WHERE auto_convert_to_recording = true
      AND converted_recording_id IS NULL
      AND (scheduled_at + make_interval(mins => duration_minutes)) <= now()
  LOOP
    IF _lc.recording_visibility = 'immediate' THEN
      _publish_at := now();
    ELSIF _lc.recording_visibility = 'delayed' THEN
      _publish_at := now() + make_interval(mins => COALESCE(_lc.recording_publish_delay_minutes, 0));
    ELSE
      _publish_at := NULL;
    END IF;

    IF _lc.recording_hide_after_days IS NOT NULL THEN
      _expires_at := COALESCE(_publish_at, now()) + make_interval(days => _lc.recording_hide_after_days);
    ELSE
      _expires_at := NULL;
    END IF;

    INSERT INTO public.recordings (
      user_id, title, description, external_url, duration_minutes, recorded_on,
      is_public, publish_at, expires_at, source_live_class_id
    ) VALUES (
      _lc.user_id, _lc.title, _lc.description, _lc.meeting_url, _lc.duration_minutes, (_lc.scheduled_at)::date,
      COALESCE(_lc.is_public, false), _publish_at, _expires_at, _lc.id
    ) RETURNING id INTO _new_rec_id;

    UPDATE public.live_classes
      SET converted_recording_id = _new_rec_id, converted_at = now()
      WHERE id = _lc.id;
    _converted := _converted + 1;
  END LOOP;

  WITH updated AS (
    UPDATE public.recordings
      SET archived_at = now()
      WHERE archived_at IS NULL
        AND expires_at IS NOT NULL AND expires_at <= now()
      RETURNING 1
  )
  SELECT count(*) INTO _archived FROM updated;

  RETURN QUERY SELECT _converted, _archived;
END;
$$;

-- 20260716144616_a3b5eb8b-0183-4b94-a94d-5f296923a6c5.sql

CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT email FROM public.profiles
  WHERE phone = _phone
     OR regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
  LIMIT 1;
$$;

-- 20260806143015_8ca16608-3f90-401c-9760-a5a2cde0cfd8.sql

CREATE OR REPLACE FUNCTION public.current_workspace_owner() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1
$$;

-- 20260806143015_8ca16608-3f90-401c-9760-a5a2cde0cfd8.sql

CREATE OR REPLACE FUNCTION public.get_invitation_preview(_token uuid) RETURNS TABLE (email text, studio_name text, invited_at timestamptz, expires_at timestamptz, status text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _inv RECORD; _name text;
BEGIN
  SELECT * INTO _inv FROM public.staff_invitations WHERE staff_invitations.token = _token LIMIT 1;
  IF _inv.id IS NULL THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::timestamptz, NULL::timestamptz, 'invalid'::text;
    RETURN;
  END IF;
  SELECT s.studio_name INTO _name FROM public.studio_settings s WHERE s.owner_id = _inv.owner_id LIMIT 1;
  RETURN QUERY SELECT
    _inv.email,
    COALESCE(_name, 'TRINETRA YOGA'),
    _inv.created_at,
    _inv.expires_at,
    CASE
      WHEN _inv.revoked_at IS NOT NULL THEN 'revoked'
      WHEN _inv.accepted_at IS NOT NULL THEN 'accepted'
      WHEN _inv.expires_at <= now() THEN 'expired'
      ELSE 'pending'
    END;
END;
$$;

-- 20260806143015_8ca16608-3f90-401c-9760-a5a2cde0cfd8.sql

CREATE OR REPLACE FUNCTION public.accept_staff_invitation(_token uuid) RETURNS TABLE (owner_id uuid, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _inv RECORD;
  _existing public.app_role;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to accept an invitation';
  END IF;

  SELECT lower(u.email) INTO _email FROM auth.users u WHERE u.id = _uid;

  SELECT * INTO _inv FROM public.staff_invitations i
   WHERE i.token = _token FOR UPDATE;

  IF _inv.id IS NULL THEN RAISE EXCEPTION 'This invitation link is not valid'; END IF;
  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invitation has been revoked'; END IF;
  IF _inv.expires_at <= now() THEN RAISE EXCEPTION 'This invitation has expired'; END IF;
  IF lower(_inv.email) IS DISTINCT FROM _email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  SELECT r.role INTO _existing FROM public.user_roles r WHERE r.user_id = _uid;
  IF _existing = 'owner' THEN
    RETURN QUERY SELECT _inv.owner_id, 'already_owner'::text;
    RETURN;
  END IF;

  INSERT INTO public.user_roles (user_id, owner_id, role)
  VALUES (_uid, _inv.owner_id, 'staff')
  ON CONFLICT (user_id) DO UPDATE SET owner_id = EXCLUDED.owner_id, role = 'staff';

  INSERT INTO public.staff_permissions (
    owner_id, staff_user_id, can_customers, can_gallery, can_classes, can_payments, can_renewals, is_active
  ) VALUES (_inv.owner_id, _uid, false, false, false, false, false, true)
  ON CONFLICT (staff_user_id) DO UPDATE SET owner_id = EXCLUDED.owner_id;

  UPDATE public.staff_invitations
     SET accepted_at = COALESCE(accepted_at, now()), accepted_by = _uid
   WHERE id = _inv.id;

  RETURN QUERY SELECT _inv.owner_id, 'accepted'::text;
END;
$$;

-- 20260811024710_7bfb97b3-938b-4a84-999c-707c229553ab.sql

CREATE OR REPLACE FUNCTION public.transfer_ownership(_new_owner uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _cur uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT user_id INTO _cur FROM public.user_roles
   WHERE role = 'owner' ORDER BY created_at ASC LIMIT 1;

  IF _cur IS NULL OR _cur <> _uid THEN
    RAISE EXCEPTION 'Only the current Owner can transfer ownership';
  END IF;
  IF _new_owner = _uid THEN RAISE EXCEPTION 'You are already the Owner'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _new_owner AND role = 'staff' AND owner_id = _uid
  ) THEN
    RAISE EXCEPTION 'The new owner must be an active Staff member of this workspace';
  END IF;

  -- Move every workspace record to the new owner (same data, same workspace).
  UPDATE public.students          SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.batches           SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.student_payments  SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.attendance        SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.biometric_devices SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.gallery_items     SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.live_classes      SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.recordings        SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.offers            SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.coupons           SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.offer_redemptions SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.learning_insights SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.insight_fields    SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.instructors       SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.locations         SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.expenses          SET user_id = _new_owner WHERE user_id = _cur;
  UPDATE public.chatbot_knowledge         SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.chatbot_pending_questions SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.chatbot_chat_history      SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.payment_audit_logs        SET owner_id = _new_owner WHERE owner_id = _cur;
  UPDATE public.staff_invitations         SET owner_id = _new_owner WHERE owner_id = _cur;

  -- Settings & security travel with the workspace.
  DELETE FROM public.studio_settings WHERE owner_id = _new_owner;
  UPDATE public.studio_settings SET owner_id = _new_owner WHERE owner_id = _cur;
  DELETE FROM public.studio_security WHERE owner_id = _new_owner;
  UPDATE public.studio_security SET owner_id = _new_owner WHERE owner_id = _cur;

  -- Swap roles.
  UPDATE public.user_roles SET role = 'owner', owner_id = _new_owner WHERE user_id = _new_owner;
  UPDATE public.user_roles SET role = 'staff', owner_id = _new_owner WHERE user_id = _cur;
  UPDATE public.user_roles SET owner_id = _new_owner WHERE owner_id = _cur;

  -- Staff permission rows follow the new owner; previous owner becomes staff.
  UPDATE public.staff_permissions SET owner_id = _new_owner WHERE owner_id = _cur;
  DELETE FROM public.staff_permissions WHERE staff_user_id = _new_owner;
  -- Previous Owner gets the default Staff access: Members only. The new Owner
  -- can grant additional modules from Settings → Staff & Permissions.
  INSERT INTO public.staff_permissions (
    owner_id, staff_user_id, can_customers, can_gallery, can_classes, can_payments, can_renewals, is_active
  ) VALUES (_new_owner, _cur, true, false, false, false, false, true)
  ON CONFLICT (staff_user_id) DO UPDATE
    SET owner_id = _new_owner, is_active = true,
        can_customers = true, can_gallery = false, can_classes = false,
        can_payments = false, can_renewals = false;

  RETURN 'transferred';
END;
$$;

-- 20260807020838_8983c391-acde-4e33-b7dc-12fffb11234e.sql

CREATE OR REPLACE FUNCTION public.student_payments_set_status() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.due_amount IS NULL OR NEW.due_amount < 0 THEN
    NEW.due_amount := 0;
  END IF;
  NEW.payment_status := CASE WHEN NEW.due_amount > 0 THEN 'partial' ELSE 'paid' END;
  RETURN NEW;
END;
$$;

-- 20260807020838_8983c391-acde-4e33-b7dc-12fffb11234e.sql

CREATE OR REPLACE FUNCTION public.get_workspace_owner_info() RETURNS TABLE (user_id uuid, full_name text, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.user_id, p.full_name, COALESCE(p.email, u.email)
  FROM public.user_roles r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN auth.users u ON u.id = r.user_id
  WHERE r.role = 'owner'
  ORDER BY r.created_at ASC
  LIMIT 1;
$$;

-- 20260810030920_de8d9bd2-7305-4bf8-8476-0f31ae279d0f.sql

CREATE FUNCTION public.get_default_studio_meta() RETURNS TABLE (owner_id uuid, studio_name text, logo_url text, background_url text, terms_enabled boolean, terms_image_url text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _perm uuid;
BEGIN
  SELECT ur.user_id INTO _perm FROM public.user_roles ur
   WHERE ur.role = 'owner' ORDER BY ur.created_at ASC LIMIT 1;
  RETURN QUERY
  SELECT s.owner_id, s.studio_name, s.logo_url, s.background_url, s.terms_enabled, s.terms_image_url
    FROM public.studio_settings s WHERE s.owner_id = _perm LIMIT 1;
END;
$$;

-- 20260810030920_de8d9bd2-7305-4bf8-8476-0f31ae279d0f.sql

CREATE FUNCTION public.get_public_studio_meta(_owner uuid) RETURNS TABLE (owner_id uuid, studio_name text, logo_url text, background_url text, terms_enabled boolean, terms_image_url text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT owner_id, studio_name, logo_url, background_url, terms_enabled, terms_image_url
  FROM public.studio_settings
  WHERE owner_id = _owner
  LIMIT 1;
$$;

-- 20260811025128_7394a89c-2c94-44a4-804d-265fdf59e465.sql

CREATE FUNCTION public.get_batch_by_token(_token uuid) RETURNS TABLE (id uuid, user_id uuid, name text, description text, fee numeric, start_date date, required_fields text[], custom_fields jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id, user_id, name, description, fee, start_date, required_fields, custom_fields
  FROM public.batches WHERE public_token = _token LIMIT 1;
$$;

-- 20260811025128_7394a89c-2c94-44a4-804d-265fdf59e465.sql

CREATE FUNCTION public.register_student_via_token(_token uuid, _name text, _email text, _phone text, _address text, _notes text, _height_cm numeric = CAST(NULL AS numeric), _weight_kg numeric = CAST(NULL AS numeric), _custom_data jsonb = CAST('{}' AS jsonb), _terms_agreed boolean = FALSE) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _batch RECORD; _new_id UUID;
  _name_clean TEXT; _email_clean TEXT; _phone_clean TEXT; _address_clean TEXT; _notes_clean TEXT;
  _cf jsonb; _field jsonb; _fname text; _fid text; _fval text;
  _terms_required boolean;
BEGIN
  _name_clean := NULLIF(trim(_name), '');
  _email_clean := NULLIF(lower(trim(_email)), '');
  _phone_clean := NULLIF(trim(_phone), '');
  _address_clean := NULLIF(trim(_address), '');
  _notes_clean := NULLIF(trim(_notes), '');

  IF _name_clean IS NULL OR length(_name_clean) < 2 OR length(_name_clean) > 80 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _email_clean IS NOT NULL AND (length(_email_clean) > 120 OR _email_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Invalid email'; END IF;
  IF _phone_clean IS NOT NULL AND (length(_phone_clean) > 30 OR _phone_clean !~ '^[0-9+\-\s()]+$') THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF _address_clean IS NOT NULL AND length(_address_clean) > 300 THEN RAISE EXCEPTION 'Address too long'; END IF;
  IF _notes_clean IS NOT NULL AND length(_notes_clean) > 500 THEN RAISE EXCEPTION 'Notes too long'; END IF;
  IF _height_cm IS NOT NULL AND (_height_cm < 30 OR _height_cm > 272) THEN RAISE EXCEPTION 'Invalid height'; END IF;
  IF _weight_kg IS NOT NULL AND (_weight_kg < 2 OR _weight_kg > 500) THEN RAISE EXCEPTION 'Invalid weight'; END IF;

  SELECT id, user_id, custom_fields INTO _batch FROM public.batches WHERE public_token = _token LIMIT 1;
  IF _batch.id IS NULL THEN RAISE EXCEPTION 'Invalid batch link'; END IF;

  -- Server-side Terms & Conditions enforcement: when the studio has terms enabled
  -- with an uploaded image, the registration must include the agreement.
  SELECT (COALESCE(s.terms_enabled, false) AND s.terms_image_url IS NOT NULL)
    INTO _terms_required
    FROM public.studio_settings s
   WHERE s.owner_id = _batch.user_id;
  IF COALESCE(_terms_required, false) AND NOT COALESCE(_terms_agreed, false) THEN
    RAISE EXCEPTION 'You must agree to the Terms & Conditions to register';
  END IF;

  _cf := COALESCE(_batch.custom_fields, '[]'::jsonb);
  FOR _field IN SELECT * FROM jsonb_array_elements(_cf) LOOP
    IF COALESCE((_field->>'enabled')::boolean, true) AND COALESCE((_field->>'required')::boolean, false) THEN
      _fid := _field->>'id';
      _fname := _field->>'name';
      _fval := NULLIF(trim(COALESCE(_custom_data->>_fid, '')), '');
      IF _fval IS NULL THEN RAISE EXCEPTION '% is required', _fname; END IF;
    END IF;
  END LOOP;

  IF _email_clean IS NOT NULL AND EXISTS (SELECT 1 FROM public.students WHERE batch_id = _batch.id AND lower(email) = _email_clean AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'A registration with this email already exists';
  END IF;
  IF _phone_clean IS NOT NULL AND EXISTS (SELECT 1 FROM public.students WHERE batch_id = _batch.id AND phone = _phone_clean AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'A registration with this phone already exists';
  END IF;

  INSERT INTO public.students (user_id, batch_id, name, email, phone, address, notes, height_cm, weight_kg, custom_data)
  VALUES (_batch.user_id, _batch.id, _name_clean, _email_clean, _phone_clean, _address_clean, _notes_clean, _height_cm, _weight_kg, COALESCE(_custom_data, '{}'::jsonb))
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE OR REPLACE FUNCTION public.can_access_student(_user_id uuid, _student_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
$$;


-- Function ACLs (recorded state, no inferred role grants)

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_owner_id(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_gallery(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_gallery(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.get_public_gallery(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_live_classes(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_live_classes(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.get_public_live_classes(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.staff_has_permission(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_staff_permissions() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.handle_new_staff_permissions() FROM anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_staff_permissions() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_gallery(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.recordings_set_slug() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.recordings_set_slug() FROM anon;

REVOKE EXECUTE ON FUNCTION public.recordings_set_slug() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_recordings(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_recordings(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.get_public_recordings(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_recording_by_slug(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_recording_by_slug(text) TO anon;

GRANT EXECUTE ON FUNCTION public.get_recording_by_slug(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.process_live_class_lifecycle() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.process_live_class_lifecycle() FROM anon;

REVOKE EXECUTE ON FUNCTION public.process_live_class_lifecycle() FROM authenticated;

GRANT EXECUTE ON FUNCTION public.process_live_class_lifecycle() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.current_workspace_owner() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.current_workspace_owner() FROM anon;

GRANT EXECUTE ON FUNCTION public.current_workspace_owner() TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_workspace_owner() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_invitation_preview(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.transfer_ownership(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.transfer_ownership(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.transfer_ownership(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.student_payments_set_status() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.student_payments_set_status() FROM anon;

REVOKE EXECUTE ON FUNCTION public.student_payments_set_status() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.get_workspace_owner_info() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_workspace_owner_info() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_workspace_owner_info() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_default_studio_meta() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_default_studio_meta() TO anon;

GRANT EXECUTE ON FUNCTION public.get_default_studio_meta() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_studio_meta(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_studio_meta(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.get_public_studio_meta(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_batch_by_token(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.get_batch_by_token(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric, jsonb, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric, jsonb, boolean) TO anon;

GRANT EXECUTE ON FUNCTION public.register_student_via_token(uuid, text, text, text, text, text, numeric, numeric, jsonb, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.can_access_student(uuid, uuid) TO authenticated;


-- Final application and storage RLS policies

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR select TO authenticated USING (auth.uid() = id);

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR update TO authenticated USING (auth.uid() = id);

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR insert TO authenticated WITH CHECK (auth.uid() = id);

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users manage own locations" ON public.locations AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users manage own instructors" ON public.instructors AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users manage own students" ON public.students AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE POLICY "Users manage own expenses" ON public.expenses AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Users see roles in their workspace" ON public.user_roles AS PERMISSIVE FOR select TO authenticated USING (user_id = auth.uid() OR owner_id = auth.uid() OR owner_id = public.get_owner_id(auth.uid()));

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Owner manages own invitation" ON public.staff_invitations AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Workspace can read settings" ON public.studio_settings AS PERMISSIVE FOR select TO authenticated USING (owner_id = auth.uid() OR owner_id = public.get_owner_id(auth.uid()));

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Owner manages settings" ON public.studio_settings AS PERMISSIVE FOR all TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Owner uploads logo" ON storage.objects AS PERMISSIVE FOR insert TO authenticated WITH CHECK (bucket_id = 'studio-logos' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Owner updates logo" ON storage.objects AS PERMISSIVE FOR update TO authenticated USING (bucket_id = 'studio-logos' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE POLICY "Owner deletes logo" ON storage.objects AS PERMISSIVE FOR delete TO authenticated USING (bucket_id = 'studio-logos' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE POLICY "Owner views own payments" ON public.student_payments AS PERMISSIVE FOR select TO authenticated USING (auth.uid() = user_id);

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE POLICY "Owner inserts own payments" ON public.student_payments AS PERMISSIVE FOR insert TO authenticated WITH CHECK (auth.uid() = user_id);

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE POLICY "Owner updates own payments" ON public.student_payments AS PERMISSIVE FOR update TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE POLICY "Owner deletes own payments" ON public.student_payments AS PERMISSIVE FOR delete TO authenticated USING (auth.uid() = user_id);

-- 20260429030800_d21f4527-bee4-4df7-b90e-119aaf69d506.sql

CREATE POLICY "Users manage own batches" ON public.batches AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260501050720_17a2ed67-78ce-4911-8734-61f8865282df.sql

CREATE POLICY "Owners upload backgrounds" ON storage.objects AS PERMISSIVE FOR insert TO authenticated WITH CHECK (bucket_id = 'studio-backgrounds' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260501050720_17a2ed67-78ce-4911-8734-61f8865282df.sql

CREATE POLICY "Owners update backgrounds" ON storage.objects AS PERMISSIVE FOR update TO authenticated USING (bucket_id = 'studio-backgrounds' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260501050720_17a2ed67-78ce-4911-8734-61f8865282df.sql

CREATE POLICY "Owners delete backgrounds" ON storage.objects AS PERMISSIVE FOR delete TO authenticated USING (bucket_id = 'studio-backgrounds' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260502080439_8581d42a-5336-48a1-92b3-be2f0efd0dba.sql

CREATE POLICY "Users cannot insert roles directly" ON public.user_roles AS PERMISSIVE FOR insert TO authenticated WITH CHECK (FALSE);

-- 20260502080439_8581d42a-5336-48a1-92b3-be2f0efd0dba.sql

CREATE POLICY "Users cannot update roles directly" ON public.user_roles AS PERMISSIVE FOR update TO authenticated USING (FALSE) WITH CHECK (FALSE);

-- 20260502080439_8581d42a-5336-48a1-92b3-be2f0efd0dba.sql

CREATE POLICY "Users cannot delete roles directly" ON public.user_roles AS PERMISSIVE FOR delete TO authenticated USING (FALSE);

-- 20260503091843_eda96d52-aa02-43fb-a026-d504bbc05ed8.sql

CREATE POLICY "Invitee can view own invitation" ON public.staff_invitations AS PERMISSIVE FOR select TO authenticated USING (lower(email) = lower((SELECT email FROM public.profiles WHERE id = auth.uid())));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Owner manages own gallery" ON public.gallery_items AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Owner manages own recordings" ON public.recordings AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Owner manages own live classes" ON public.live_classes AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace reads gallery files" ON storage.objects AS PERMISSIVE FOR select TO authenticated USING (bucket_id = 'studio-gallery' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace writes gallery files" ON storage.objects AS PERMISSIVE FOR insert TO authenticated WITH CHECK (bucket_id = 'studio-gallery' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace updates gallery files" ON storage.objects AS PERMISSIVE FOR update TO authenticated USING (bucket_id = 'studio-gallery' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace deletes gallery files" ON storage.objects AS PERMISSIVE FOR delete TO authenticated USING (bucket_id = 'studio-gallery' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace reads recordings files" ON storage.objects AS PERMISSIVE FOR select TO authenticated USING (bucket_id = 'studio-recordings' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace writes recordings files" ON storage.objects AS PERMISSIVE FOR insert TO authenticated WITH CHECK (bucket_id = 'studio-recordings' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace updates recordings files" ON storage.objects AS PERMISSIVE FOR update TO authenticated USING (bucket_id = 'studio-recordings' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE POLICY "Workspace deletes recordings files" ON storage.objects AS PERMISSIVE FOR delete TO authenticated USING (bucket_id = 'studio-recordings' AND (((storage.foldername(name)))[1] = CAST(auth.uid() AS text) OR ((storage.foldername(name)))[1] = CAST(public.get_owner_id(auth.uid()) AS text)));

-- 20260610142421_c158bc3e-64b1-44fc-b47d-eb769d886b4a.sql

CREATE POLICY "Owner manages own security" ON public.studio_security AS PERMISSIVE FOR all TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 20260613035336_ded3f24f-f026-4955-9b69-713357e1215c.sql

CREATE POLICY "Owner can view their studio audit logs" ON public.payment_audit_logs AS PERMISSIVE FOR select TO authenticated USING (auth.uid() = owner_id);

-- 20260613035336_ded3f24f-f026-4955-9b69-713357e1215c.sql

CREATE POLICY "Studio members can insert audit logs" ON public.payment_audit_logs AS PERMISSIVE FOR insert TO authenticated WITH CHECK (auth.uid() = user_id AND (auth.uid() = owner_id OR public.get_owner_id(auth.uid()) = owner_id));

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE POLICY "Owner views history" ON public.chatbot_chat_history AS PERMISSIVE FOR select TO authenticated USING (owner_id = auth.uid());

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE POLICY "Owner deletes history" ON public.chatbot_chat_history AS PERMISSIVE FOR delete TO authenticated USING (owner_id = auth.uid());

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE POLICY "Owner manages pending" ON public.chatbot_pending_questions AS PERMISSIVE FOR all TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE POLICY "Owner manages biometric devices" ON public.biometric_devices AS PERMISSIVE FOR all TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE POLICY "Owners manage their offers" ON public.offers AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id OR (public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()))) WITH CHECK (auth.uid() = user_id OR (public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid())));

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE POLICY "Owners manage their coupons" ON public.coupons AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id OR (public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()))) WITH CHECK (auth.uid() = user_id OR (public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid())));

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE POLICY "Owners view their redemptions" ON public.offer_redemptions AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id OR (public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()))) WITH CHECK (auth.uid() = user_id OR (public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid())));

-- 20260726100334_4c8e7ee4-7f8f-4a1b-bdb1-f03b38e6cdfa.sql

CREATE POLICY "Owners full access attendance" ON public.attendance AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 20260805021224_afebc5ff-01fd-4f39-a95e-90c9980312c5.sql

CREATE POLICY "Workspace can view insight fields" ON public.insight_fields AS PERMISSIVE FOR select TO authenticated USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

-- 20260805021224_afebc5ff-01fd-4f39-a95e-90c9980312c5.sql

CREATE POLICY "Workspace can insert insight fields" ON public.insight_fields AS PERMISSIVE FOR insert TO authenticated WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

-- 20260805021224_afebc5ff-01fd-4f39-a95e-90c9980312c5.sql

CREATE POLICY "Workspace can update insight fields" ON public.insight_fields AS PERMISSIVE FOR update TO authenticated USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid())) WITH CHECK (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

-- 20260805021224_afebc5ff-01fd-4f39-a95e-90c9980312c5.sql

CREATE POLICY "Workspace can delete insight fields" ON public.insight_fields AS PERMISSIVE FOR delete TO authenticated USING (user_id = auth.uid() OR user_id = public.get_owner_id(auth.uid()));

-- 20260812051108_b608ff52-f144-415e-ac17-70a0b2ec3d6a.sql

CREATE POLICY "Owner reads logo files" ON storage.objects AS PERMISSIVE FOR select TO authenticated USING (bucket_id = 'studio-logos' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260812051108_b608ff52-f144-415e-ac17-70a0b2ec3d6a.sql

CREATE POLICY "Owner reads background files" ON storage.objects AS PERMISSIVE FOR select TO authenticated USING (bucket_id = 'studio-backgrounds' AND CAST(auth.uid() AS text) = ((storage.foldername(name)))[1]);

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Owners view workspace profiles" ON public.profiles AS PERMISSIVE FOR select TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles AS r WHERE r.user_id = profiles.id AND r.owner_id = auth.uid()));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff reads owner students" ON public.students AS PERMISSIVE FOR select TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND assigned_staff_id = auth.uid() AND (public.staff_has_permission(auth.uid(), 'customers') OR public.staff_has_permission(auth.uid(), 'renewals') OR public.staff_has_permission(auth.uid(), 'payments') OR public.staff_has_permission(auth.uid(), 'attendance') OR public.staff_has_permission(auth.uid(), 'insights')));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff updates owner students" ON public.students AS PERMISSIVE FOR update TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers')) WITH CHECK (user_id = public.get_owner_id(auth.uid()) AND assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers'));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff deletes owner students" ON public.students AS PERMISSIVE FOR delete TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers'));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff reads owner payments" ON public.student_payments AS PERMISSIVE FOR select TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'payments') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff inserts owner payments" ON public.student_payments AS PERMISSIVE FOR insert TO authenticated WITH CHECK (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'payments') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff updates owner payments" ON public.student_payments AS PERMISSIVE FOR update TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'payments') AND public.can_access_student(auth.uid(), student_id)) WITH CHECK (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'payments') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff deletes owner payments" ON public.student_payments AS PERMISSIVE FOR delete TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'payments') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff select attendance" ON public.attendance AS PERMISSIVE FOR select TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff insert attendance" ON public.attendance AS PERMISSIVE FOR insert TO authenticated WITH CHECK (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff update attendance" ON public.attendance AS PERMISSIVE FOR update TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance') AND public.can_access_student(auth.uid(), student_id)) WITH CHECK (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Staff delete attendance" ON public.attendance AS PERMISSIVE FOR delete TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance') AND public.can_access_student(auth.uid(), student_id));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Workspace can view learning insights" ON public.learning_insights AS PERMISSIVE FOR select TO authenticated USING (user_id = auth.uid() OR (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'insights') AND public.can_access_student(auth.uid(), student_id)));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Workspace can insert learning insights" ON public.learning_insights AS PERMISSIVE FOR insert TO authenticated WITH CHECK (user_id = auth.uid() OR (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'insights') AND public.can_access_student(auth.uid(), student_id)));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Workspace can update learning insights" ON public.learning_insights AS PERMISSIVE FOR update TO authenticated USING (user_id = auth.uid() OR (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'insights') AND public.can_access_student(auth.uid(), student_id))) WITH CHECK (user_id = auth.uid() OR (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'insights') AND public.can_access_student(auth.uid(), student_id)));

-- 20260812052030_9c047c0c-05f5-43a0-a479-683b91ed4c15.sql

CREATE POLICY "Workspace can delete learning insights" ON public.learning_insights AS PERMISSIVE FOR delete TO authenticated USING (user_id = auth.uid() OR (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'insights') AND public.can_access_student(auth.uid(), student_id)));

-- 20260816105216_76ddbb4f-beef-43a2-8289-7cea228278ee.sql

CREATE POLICY "Public reads public gallery files" ON storage.objects AS PERMISSIVE FOR select TO PUBLIC USING (bucket_id = 'studio-gallery' AND EXISTS (SELECT 1 FROM public.gallery_items AS g WHERE (g.storage_path = storage.objects.name OR g.thumbnail_path = storage.objects.name) AND g.is_public = TRUE AND (g.expires_at IS NULL OR g.expires_at > now())));

-- 20260816105216_76ddbb4f-beef-43a2-8289-7cea228278ee.sql

CREATE POLICY "Public reads public recording files" ON storage.objects AS PERMISSIVE FOR select TO PUBLIC USING (bucket_id = 'studio-recordings' AND EXISTS (SELECT 1 FROM public.recordings AS r WHERE r.storage_path = storage.objects.name AND r.is_public = TRUE AND r.archived_at IS NULL AND (r.publish_at IS NULL OR r.publish_at <= now()) AND (r.expires_at IS NULL OR r.expires_at > now())));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff reads owner batches" ON public.batches AS PERMISSIVE FOR select TO authenticated USING (user_id = get_owner_id(auth.uid()) AND (staff_has_permission(auth.uid(), 'customers') OR staff_has_permission(auth.uid(), 'renewals') OR staff_has_permission(auth.uid(), 'payments')));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff writes owner batches" ON public.batches AS PERMISSIVE FOR insert TO authenticated WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'customers'));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff updates owner batches" ON public.batches AS PERMISSIVE FOR update TO authenticated USING (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'customers')) WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'customers'));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff deletes owner batches" ON public.batches AS PERMISSIVE FOR delete TO authenticated USING (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'customers'));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Owner manages KB" ON public.chatbot_knowledge AS PERMISSIVE FOR all TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff manages owner expenses" ON public.expenses AS PERMISSIVE FOR all TO authenticated USING (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'payments')) WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'payments'));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff manages owner gallery" ON public.gallery_items AS PERMISSIVE FOR all TO authenticated USING (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'gallery')) WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'gallery'));

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Owner manages staff perms" ON public.staff_permissions AS PERMISSIVE FOR all TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Staff reads own perms" ON public.staff_permissions AS PERMISSIVE FOR select TO authenticated USING (auth.uid() = staff_user_id);

-- 20260816143219_dddb6ec2-1a86-46c6-b9eb-46933493cc23.sql

CREATE POLICY "Instructors owner only" ON public.instructors AS RESTRICTIVE FOR all TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE POLICY "Staff manages owner live classes" ON public.live_classes AS PERMISSIVE FOR all TO authenticated USING (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'classes')) WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'classes'));

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE POLICY "Staff manages owner recordings" ON public.recordings AS PERMISSIVE FOR all TO authenticated USING (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'classes')) WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'classes'));

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE POLICY "Staff writes owner students" ON public.students AS PERMISSIVE FOR insert TO authenticated WITH CHECK (user_id = get_owner_id(auth.uid()) AND staff_has_permission(auth.uid(), 'customers'));

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE POLICY "Users can insert own settings" ON public.settings AS PERMISSIVE FOR insert TO authenticated WITH CHECK (auth.uid() = id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE POLICY "Users can update own settings" ON public.settings AS PERMISSIVE FOR update TO authenticated USING (auth.uid() = id);

-- 20260817033009_859f7a2a-2ab7-4ab1-82bf-2d3022e108e0.sql

CREATE POLICY "Users can view own settings" ON public.settings AS PERMISSIVE FOR select TO authenticated USING (auth.uid() = id);

-- 20260930061701_b90e6ec1-3eee-4a89-a318-eae64440f6e3.sql

CREATE POLICY "Attendance staff reads owner batches" ON public.batches AS PERMISSIVE FOR select TO authenticated USING (user_id = public.get_owner_id(auth.uid()) AND public.staff_has_permission(auth.uid(), 'attendance'));

-- 20260930065545_5748f5bd-7945-45f8-b114-6bfe46c20234.sql

CREATE POLICY "Server manages face enrollments" ON public.member_face_enrollments AS PERMISSIVE FOR all TO service_role USING (TRUE) WITH CHECK (TRUE);

-- 20260930070904_6d73d331-355a-4ec7-adbb-feec0c52f225.sql

CREATE POLICY "Member editors upload private photos" ON storage.objects AS PERMISSIVE FOR insert TO authenticated WITH CHECK (bucket_id = 'member-photos' AND EXISTS (SELECT 1 FROM public.students AS s WHERE CAST(s.id AS text) = ((storage.foldername(storage.objects.name)))[2] AND CAST(s.user_id AS text) = ((storage.foldername(storage.objects.name)))[1] AND ((s.user_id = auth.uid() AND public.has_role(auth.uid(), 'owner')) OR (s.user_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers')))));

-- 20260930070904_6d73d331-355a-4ec7-adbb-feec0c52f225.sql

CREATE POLICY "Member editors remove private photos" ON storage.objects AS PERMISSIVE FOR delete TO authenticated USING (bucket_id = 'member-photos' AND EXISTS (SELECT 1 FROM public.students AS s WHERE CAST(s.id AS text) = ((storage.foldername(storage.objects.name)))[2] AND CAST(s.user_id AS text) = ((storage.foldername(storage.objects.name)))[1] AND ((s.user_id = auth.uid() AND public.has_role(auth.uid(), 'owner')) OR (s.user_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers')))));

-- 20260930070904_6d73d331-355a-4ec7-adbb-feec0c52f225.sql

CREATE POLICY "Workspace reads private member photos" ON storage.objects AS PERMISSIVE FOR select TO authenticated USING (bucket_id = 'member-photos' AND EXISTS (SELECT 1 FROM public.students AS s WHERE CAST(s.id AS text) = ((storage.foldername(storage.objects.name)))[2] AND CAST(s.user_id AS text) = ((storage.foldername(storage.objects.name)))[1] AND ((s.user_id = auth.uid() AND public.has_role(auth.uid(), 'owner')) OR (s.user_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND (public.staff_has_permission(auth.uid(), 'customers') OR public.staff_has_permission(auth.uid(), 'attendance'))))));

-- 20261007055410_f5333e1c-186c-44ff-b564-d8362f8313ad.sql

CREATE POLICY "Workspace reads face descriptors" ON public.member_face_enrollments AS PERMISSIVE FOR select TO authenticated USING (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND (public.staff_has_permission(auth.uid(), 'attendance') OR public.staff_has_permission(auth.uid(), 'customers'))));

-- 20261007055410_f5333e1c-186c-44ff-b564-d8362f8313ad.sql

CREATE POLICY "Authorized users save face descriptors" ON public.member_face_enrollments AS PERMISSIVE FOR insert TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.students AS s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers')))));

-- 20261007055410_f5333e1c-186c-44ff-b564-d8362f8313ad.sql

CREATE POLICY "Authorized users replace face descriptors" ON public.member_face_enrollments AS PERMISSIVE FOR update TO authenticated USING (EXISTS (SELECT 1 FROM public.students AS s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers'))))) WITH CHECK (EXISTS (SELECT 1 FROM public.students AS s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers')))));

-- 20261007055410_f5333e1c-186c-44ff-b564-d8362f8313ad.sql

CREATE POLICY "Authorized users remove face descriptors" ON public.member_face_enrollments AS PERMISSIVE FOR delete TO authenticated USING (EXISTS (SELECT 1 FROM public.students AS s WHERE s.id = student_id AND s.user_id = owner_id AND (owner_id = auth.uid() OR (owner_id = public.get_owner_id(auth.uid()) AND s.assigned_staff_id = auth.uid() AND public.staff_has_permission(auth.uid(), 'customers')))));


-- Final app-owned triggers (including auth lifecycle hooks)

-- 20260312101226_13527be8-b1ab-4f3e-99ac-0e0cca5d0613.sql

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 20260425165307_f9c90528-09d3-40c6-8fc0-c161fb51aaf0.sql

CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_role();

-- 20260428043536_8ebbcc82-5ee9-4832-9a9a-a9f9193d681d.sql

CREATE TRIGGER update_student_payments_updated_at BEFORE UPDATE ON public.student_payments FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260429030800_d21f4527-bee4-4df7-b90e-119aaf69d506.sql

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE TRIGGER trg_gallery_items_updated BEFORE UPDATE ON public.gallery_items FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE TRIGGER trg_recordings_updated BEFORE UPDATE ON public.recordings FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260503092548_9467ae48-4e0c-43ba-99a8-0054b84ab258.sql

CREATE TRIGGER trg_live_classes_updated BEFORE UPDATE ON public.live_classes FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260610142421_c158bc3e-64b1-44fc-b47d-eb769d886b4a.sql

CREATE TRIGGER update_studio_security_updated_at BEFORE UPDATE ON public.studio_security FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE TRIGGER chatbot_knowledge_updated_at BEFORE UPDATE ON public.chatbot_knowledge FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260703131158_20b81e34-5268-4f05-845d-32484af0b821.sql

CREATE TRIGGER chatbot_pending_updated_at BEFORE UPDATE ON public.chatbot_pending_questions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260705121907_688d6695-0bfe-47c8-994c-ec1cb8d25c4d.sql

CREATE TRIGGER update_staff_permissions_updated_at BEFORE UPDATE ON public.staff_permissions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260705121907_688d6695-0bfe-47c8-994c-ec1cb8d25c4d.sql

CREATE TRIGGER on_user_role_created_staff_perms AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE PROCEDURE public.handle_new_staff_permissions();

-- 20260711044616_4057ba1d-588c-41ff-9368-9d2900658e53.sql

CREATE TRIGGER recordings_set_slug_trg BEFORE INSERT ON public.recordings FOR EACH ROW EXECUTE PROCEDURE public.recordings_set_slug();

-- 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE TRIGGER attendance_set_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260713033551_20bb3cac-b812-4a15-9d04-f315c44c48ca.sql

CREATE TRIGGER biometric_devices_set_updated_at BEFORE UPDATE ON public.biometric_devices FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260716145141_ff52f4cf-3f39-4131-9320-d4c396dafdf6.sql

CREATE TRIGGER offers_set_updated BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260803051338_d7158cb2-98b7-4a44-a150-90e9de2d2aff.sql

CREATE TRIGGER update_learning_insights_updated_at BEFORE UPDATE ON public.learning_insights FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260805021224_afebc5ff-01fd-4f39-a95e-90c9980312c5.sql

CREATE TRIGGER trg_insight_fields_updated BEFORE UPDATE ON public.insight_fields FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- 20260807020838_8983c391-acde-4e33-b7dc-12fffb11234e.sql

CREATE TRIGGER student_payments_status_trg BEFORE INSERT OR UPDATE ON public.student_payments FOR EACH ROW EXECUTE PROCEDURE public.student_payments_set_status();

-- 20260930065512_3209e928-8339-46f2-864a-39211ae0a359.sql

CREATE TRIGGER member_face_enrollments_updated_at BEFORE UPDATE ON public.member_face_enrollments FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();


-- FORCE RLS and replica identity

ALTER TABLE public.student_payments FORCE ROW LEVEL SECURITY ;

ALTER TABLE public.studio_security FORCE ROW LEVEL SECURITY ;

ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY ;

ALTER TABLE public.studio_settings FORCE ROW LEVEL SECURITY ;

ALTER TABLE public.staff_invitations FORCE ROW LEVEL SECURITY ;

ALTER TABLE public.students REPLICA IDENTITY FULL;

ALTER TABLE public.batches REPLICA IDENTITY FULL;

ALTER TABLE public.student_payments REPLICA IDENTITY FULL;

ALTER TABLE public.offers REPLICA IDENTITY FULL;

ALTER TABLE public.coupons REPLICA IDENTITY FULL;

ALTER TABLE public.gallery_items REPLICA IDENTITY FULL;

ALTER TABLE public.recordings REPLICA IDENTITY FULL;

ALTER TABLE public.live_classes REPLICA IDENTITY FULL;

ALTER TABLE public.attendance REPLICA IDENTITY FULL;


-- Managed realtime publication membership; existing publication prerequisite

ALTER PUBLICATION supabase_realtime ADD TABLE public.students;

ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;

ALTER PUBLICATION supabase_realtime ADD TABLE public.student_payments;

ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;

ALTER PUBLICATION supabase_realtime ADD TABLE public.coupons;

ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_items;

ALTER PUBLICATION supabase_realtime ADD TABLE public.recordings;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_classes;

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_permissions;

ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_invitations;


-- Managed extension dependency (not recreated by this reference)

-- CREATE EXTENSION IF NOT EXISTS pg_cron; -- installation/schema/version require manual verification
