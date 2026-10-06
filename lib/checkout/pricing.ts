/**
 * Checkout arithmetic, in whole CENTS (integers) so 0.1 + 0.2 style rounding errors can never move a price.
 * Shillings in, shillings out; cents inside. The server runs this for real; the browser only displays it.
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

const toCents = (shillings: number) => Math.round(shillings * 100);
const toShillings = (cents: number) => cents / 100;

/** Why a coupon cannot be used right now, in a short sentence for the buyer. Reasons never reveal other codes. */
export function checkCoupon(rule: CouponRule | null, subtotal: number, now: Date): CouponResult {
  if (!rule || !rule.isActive) return { ok: false, reason: "That code is not valid." };
  if (rule.startsAt && now < rule.startsAt) return { ok: false, reason: "That code is not active yet." };
  if (rule.endsAt && now > rule.endsAt) return { ok: false, reason: "That code has expired." };
  if (rule.maxRedemptions !== null && rule.used >= rule.maxRedemptions) return { ok: false, reason: "That code has been fully used." };
  if (rule.minSubtotal !== null && subtotal < rule.minSubtotal) return { ok: false, reason: `Spend at least KES ${rule.minSubtotal.toLocaleString("en-KE")} to use that code.` };

  const cents = toCents(subtotal);
  const off = rule.type === "PERCENT" ? Math.round((cents * Math.min(100, Math.max(0, rule.value))) / 100) : toCents(Math.max(0, rule.value));
  return { ok: true, discount: toShillings(Math.min(off, cents)) }; // a discount can never go below zero
}

/** Fee as a percentage of what is left after the discount (0 means no fee). */
export function feeFor(afterDiscount: number, percent: number): number {
  if (!(percent > 0)) return 0;
  return toShillings(Math.round((toCents(afterDiscount) * percent) / 100));
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
