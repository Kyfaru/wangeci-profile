import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import { checkCoupon, totals, type Totals } from "./pricing";

const PENDING_HOLD_MS = 30 * 60_000;

export interface QuoteItem {
  editionId: string;
  title: string;
  price: number;
  currency: string;
}

export interface Quote extends Totals {
  items: QuoteItem[];
  currency: string;
  coupon: { id: string; code: string } | null;
  /** Why the coupon was refused, when one was sent. */
  couponError: string | null;
}

export class QuoteError extends Error {
  constructor(readonly code: "EMPTY" | "UNAVAILABLE" | "TOO_MANY", message: string, readonly status = 400) {
    super(message);
    this.name = "QuoteError";
  }
}

/**
 * The ONE place a price is made. Reads editions and the coupon from the database; the browser only
 * contributes edition ids and the code text. The quote endpoint and order creation both call this,
 * so what the buyer sees is what the order charges.
 */
export async function buildQuote(editionIds: string[], couponCode?: string | null, now = new Date()): Promise<Quote> {
  const ids = [...new Set(editionIds)];
  if (ids.length === 0) throw new QuoteError("EMPTY", "Your cart is empty.");
  if (ids.length > 10) throw new QuoteError("TOO_MANY", "Too many items in one order.");

  const editions = await prisma.edition.findMany({ where: { id: { in: ids }, isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } }, include: { work: true } });
  if (editions.length !== ids.length) throw new QuoteError("UNAVAILABLE", "One of the items is no longer available.", 409);
  const currency = editions[0].currency;
  if (editions.some((e) => e.currency !== currency)) throw new QuoteError("UNAVAILABLE", "Items use different currencies.", 409);

  const items = editions.map((e) => ({ editionId: e.id, title: e.title ?? e.work.title, price: Number(e.price), currency }));
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);

  let discount = 0;
  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    const row = await prisma.coupon.findUnique({ where: { code } });
    const pending = row ? await prisma.order.count({ where: { couponId: row.id, status: "PENDING", createdAt: { gt: new Date(now.getTime() - PENDING_HOLD_MS) } } }) : 0;
    const result = checkCoupon(
      row && { code: row.code, type: row.type, value: Number(row.value), minSubtotal: row.minSubtotal === null ? null : Number(row.minSubtotal), maxRedemptions: row.maxRedemptions, used: row.timesRedeemed + pending, startsAt: row.startsAt, endsAt: row.endsAt, isActive: row.isActive },
      subtotal,
      now,
    );
    if (result.ok && row) {
      discount = result.discount;
      coupon = { id: row.id, code: row.code };
    } else if (!result.ok) {
      couponError = result.reason;
    }
  }

  return { ...totals({ subtotal, discount, feePercent: env.CHECKOUT_FEE_PERCENT }), items, currency, coupon, couponError };
}
