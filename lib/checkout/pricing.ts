/**
 * Checkout arithmetic, in whole CENTS (integers) so 0.1 + 0.2 style rounding errors can never move a price.
 * Shillings in, shillings out; cents inside. The server runs this for real; the browser only displays it.
 * Discounts and fees are whole shillings: M-Pesa cannot collect cents, and one rule for every method is simpler.
 */
export interface CouponRule {
  code: string;
  type: "PERCENT" | "FIXED";
  /** PERCENT: 1 to 100. FIXED: shillings. */
  value: number;
  minSubtotal: number | null;
  maxRedemptions: number | null;
  /** Paid redemptions plus orders still waiting for payment (so a code cannot be used past its limit in parallel). */
  used: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export type CouponResult = { ok: true; discount: number } | { ok: false; reason: string };

/** The ONE refusal text for every reason a code cannot be used, so the answer never says which codes exist or why they fail. */
export const COUPON_INVALID = "That code is not valid.";

const toCents = (shillings: number) => Math.round(shillings * 100);
const toShillings = (cents: number) => cents / 100;

/** Why a coupon cannot be used right now. The reason is always the same sentence (see COUPON_INVALID). */
export function checkCoupon(rule: CouponRule | null, subtotal: number, now: Date): CouponResult {
  if (!rule || !rule.isActive) return { ok: false, reason: COUPON_INVALID };
  if (rule.startsAt && now < rule.startsAt) return { ok: false, reason: COUPON_INVALID };
  if (rule.endsAt && now > rule.endsAt) return { ok: false, reason: COUPON_INVALID };
  if (rule.maxRedemptions !== null && rule.used >= rule.maxRedemptions) return { ok: false, reason: COUPON_INVALID };
  if (rule.minSubtotal !== null && subtotal < rule.minSubtotal) return { ok: false, reason: COUPON_INVALID };

  const cents = toCents(subtotal);
  const off = rule.type === "PERCENT" ? (cents * Math.min(100, Math.max(0, rule.value))) / 100 : toCents(Math.max(0, rule.value));
  const wholeShillings = Math.round(off / 100);
  return { ok: true, discount: Math.min(wholeShillings, toShillings(cents)) }; // a discount can never go below zero
}

/** Fee as a percentage of what is left after the discount, in whole shillings (0 means no fee). */
export function feeFor(afterDiscount: number, percent: number): number {
  if (!(percent > 0)) return 0;
  return Math.round((toCents(afterDiscount) * percent) / 10_000);
}

export interface Totals {
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
}

export function totals(input: { subtotal: number; discount: number; feePercent: number }): Totals {
  const subtotalC = toCents(input.subtotal);
  const discountC = Math.min(toCents(input.discount), subtotalC);
  const afterC = subtotalC - discountC;
  const feeC = toCents(feeFor(toShillings(afterC), input.feePercent));
  return { subtotal: toShillings(subtotalC), discount: toShillings(discountC), fee: toShillings(feeC), total: toShillings(afterC + feeC) };
}
