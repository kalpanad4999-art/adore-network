
-- 1) Missing foreign-key indexes (pure performance, no data change)
CREATE INDEX IF NOT EXISTS idx_chatbot_pending_knowledge ON public.chatbot_pending_questions (knowledge_id);
CREATE INDEX IF NOT EXISTS idx_expenses_location ON public.expenses (location_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON public.expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_instructors_user ON public.instructors (user_id);
CREATE INDEX IF NOT EXISTS idx_locations_user ON public.locations (user_id);
CREATE INDEX IF NOT EXISTS idx_students_user ON public.students (user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_source_live_class ON public.recordings (source_live_class_id);
CREATE INDEX IF NOT EXISTS idx_coupons_offer ON public.coupons (offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_coupon ON public.offer_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_offer ON public.offer_redemptions (offer_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_applied_offer ON public.student_payments (applied_offer_id);
CREATE INDEX IF NOT EXISTS idx_learning_insights_batch ON public.learning_insights (batch_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_user ON public.gallery_items (user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_user ON public.recordings (user_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_user ON public.live_classes (user_id);

-- 2) Scope remaining policies to signed-in users (same predicates, narrower role)
DROP POLICY IF EXISTS "Staff manages owner live classes" ON public.live_classes;
CREATE POLICY "Staff manages owner live classes" ON public.live_classes
  FOR ALL TO authenticated
  USING ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(), 'classes'))
  WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(), 'classes'));

DROP POLICY IF EXISTS "Staff manages owner recordings" ON public.recordings;
CREATE POLICY "Staff manages owner recordings" ON public.recordings
  FOR ALL TO authenticated
  USING ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(), 'classes'))
  WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(), 'classes'));

DROP POLICY IF EXISTS "Staff writes owner students" ON public.students;
CREATE POLICY "Staff writes owner students" ON public.students
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = get_owner_id(auth.uid())) AND staff_has_permission(auth.uid(), 'customers'));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.settings;
CREATE POLICY "Users can insert own settings" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.settings;
CREATE POLICY "Users can update own settings" ON public.settings
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own settings" ON public.settings;
CREATE POLICY "Users can view own settings" ON public.settings
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- 3) Cross-tenant maintenance job: scheduler/service-role only
REVOKE EXECUTE ON FUNCTION public.process_live_class_lifecycle() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_live_class_lifecycle() TO service_role;
