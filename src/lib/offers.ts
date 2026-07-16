// Small shared helpers for offers/coupons eligibility + WhatsApp.
export type OfferType = "birthday" | "festival" | "new_year" | "annual" | "custom";

export interface OfferConditions {
  membership_duration_min_days?: number | null;
  membership_type?: string | null;
  batch_ids?: string[] | null;
  member_ids?: string[] | null;
  payment_status?: "any" | "paid" | "overdue" | null;
  requires_active_membership?: boolean | null;
  custom_rule?: string | null;
}

export interface Offer {
  id: string;
  user_id: string;
  name: string;
  offer_type: OfferType;
  message: string | null;
  discount_amount: number;
  min_payment_amount: number;
  valid_from: string | null;
  valid_to: string | null;
  usage_limit_total: number | null;
  usage_limit_per_member: number | null;
  usage_count: number;
  is_active: boolean;
  conditions: OfferConditions;
}

export interface Coupon {
  id: string;
  user_id: string;
  offer_id: string;
  code: string;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
}

export const OFFER_LABELS: Record<OfferType, string> = {
  birthday: "🎂 Birthday Offer",
  festival: "🎊 Festival Offer",
  new_year: "🎆 New Year Offer",
  annual: "🎉 Annual Offer",
  custom: "✨ Special Offer",
};

export const CONGRATS: Record<OfferType, string> = {
  birthday: "🎉 Congratulations! You received a Birthday Offer",
  festival: "🎊 Congratulations! You received a Festival Offer",
  new_year: "🎆 Congratulations! You received a New Year Offer",
  annual: "🎉 Congratulations! You received an Annual Offer",
  custom: "✨ Congratulations! You received a Special Offer",
};

export interface MemberContext {
  id: string;
  batch_id: string | null;
  has_active_membership?: boolean;
  membership_days?: number;
  membership_type?: string | null;
  payment_status?: "paid" | "overdue" | null;
  birthday_today?: boolean;
}

export const isOfferEligible = (offer: Offer, ctx: MemberContext | null, amount: number, todayISO: string): boolean => {
  if (!offer.is_active) return false;
  if (offer.valid_from && todayISO < offer.valid_from) return false;
  if (offer.valid_to && todayISO > offer.valid_to) return false;
  if (offer.min_payment_amount && amount < offer.min_payment_amount) return false;
  if (offer.usage_limit_total != null && offer.usage_count >= offer.usage_limit_total) return false;

  if (offer.offer_type === "birthday" && ctx && !ctx.birthday_today) return false;

  const c = offer.conditions || {};
  if (c.batch_ids && c.batch_ids.length > 0 && ctx && (!ctx.batch_id || !c.batch_ids.includes(ctx.batch_id))) return false;
  if (c.member_ids && c.member_ids.length > 0 && ctx && !c.member_ids.includes(ctx.id)) return false;
  if (c.requires_active_membership && ctx && !ctx.has_active_membership) return false;
  if (c.membership_duration_min_days && ctx && (ctx.membership_days ?? 0) < c.membership_duration_min_days) return false;
  if (c.membership_type && ctx && (ctx.membership_type ?? null) !== c.membership_type) return false;
  if (c.payment_status && c.payment_status !== "any" && ctx && ctx.payment_status !== c.payment_status) return false;
  return true;
};

export const computeDiscount = (offer: Offer, amount: number): number => {
  const d = Math.min(offer.discount_amount, amount);
  return Math.max(0, Math.round(d * 100) / 100);
};

export const waLink = (phone: string | null | undefined, message: string): string => {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(message)}`;
};
