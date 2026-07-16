
-- Offer type enum
DO $$ BEGIN
  CREATE TYPE public.offer_type AS ENUM ('birthday', 'festival', 'new_year', 'annual', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. offers
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  offer_type public.offer_type NOT NULL DEFAULT 'custom',
  message text,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  min_payment_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_payment_amount >= 0),
  valid_from date,
  valid_to date,
  usage_limit_total integer,
  usage_limit_per_member integer,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their offers" ON public.offers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()));

CREATE TRIGGER offers_set_updated BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX offers_user_active_idx ON public.offers(user_id, is_active);

-- 2. coupons
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  code text NOT NULL,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Globally-unique per studio (case-insensitive)
CREATE UNIQUE INDEX coupons_user_code_uidx ON public.coupons(user_id, upper(code));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()));

-- 3. offer_redemptions (audit)
CREATE TABLE IF NOT EXISTS public.offer_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  student_id uuid,
  payment_id uuid,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_redemptions TO authenticated;
GRANT ALL ON public.offer_redemptions TO service_role;
ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their redemptions" ON public.offer_redemptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.staff_has_permission(auth.uid(), 'payments') AND user_id = public.get_owner_id(auth.uid()));

CREATE INDEX offer_redemptions_offer_idx ON public.offer_redemptions(offer_id);
CREATE INDEX offer_redemptions_payment_idx ON public.offer_redemptions(payment_id);

-- 4. Extend student_payments with applied offer info
ALTER TABLE public.student_payments
  ADD COLUMN IF NOT EXISTS applied_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_offer_name text,
  ADD COLUMN IF NOT EXISTS applied_offer_type text,
  ADD COLUMN IF NOT EXISTS applied_coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;
