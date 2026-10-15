import type { Prisma } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/trace";

import { checkCoupon, COUPON_INVALID, totals, type Totals } from "./pricing";

/** How long an unpaid order holds a coupon slot (and blocks a second order for the same book). */
export const PENDING_HOLD_MS = 30 * 60_000;

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
  /** Why the coupon was refused, when one was sent (always the same sentence). */
  couponError: string | null;
}

export interface QuoteOptions {
  now?: Date;
  /** When known, a coupon already used (or being used) by this buyer is refused: one redemption per account/email. */
  userId?: string;
  /** Pass the transaction when pricing inside one (order creation locks the coupon row first). */
  db?: Prisma.TransactionClient;
}

/**
 * The ONE place a price is made. Reads editions and the coupon from the database; the browser only
 * contributes edition ids and the code text. The quote endpoint and order creation both call this,
 * so what the buyer sees is what the order charges.
 */
export async function buildQuote(editionIds: string[], couponCode?: string | null, { now = new Date(), userId, db = prisma }: QuoteOptions = {}): Promise<Quote> {
  const ids = [...new Set(editionIds)];
  if (ids.length === 0) throw new AppError("CHECKOUT_CART_EMPTY", "Your cart is empty.");
  if (ids.length > 10) throw new AppError("CHECKOUT_TOO_MANY_ITEMS", "Too many items in one order.");

  const editions = await db.edition.findMany({ where: { id: { in: ids }, isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } }, include: { work: true } });
  if (editions.length !== ids.length) throw new AppError("CHECKOUT_ITEM_UNAVAILABLE", "One of the items is no longer available.", 409);
  const currency = editions[0].currency;
  if (editions.some((e) => e.currency !== currency)) throw new AppError("CHECKOUT_ITEM_UNAVAILABLE", "Items use different currencies.", 409);

  const items = editions.map((e) => ({ editionId: e.id, title: e.title ?? e.work.title, price: Number(e.price), currency }));
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);

  let discount = 0;
  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    const row = await db.coupon.findUnique({ where: { code } });
    const stillPending = { status: "PENDING" as const, createdAt: { gt: new Date(now.getTime() - PENDING_HOLD_MS) } };
    const [pending, usedByBuyer] = row
      ? await Promise.all([
          db.order.count({ where: { couponId: row.id, ...stillPending } }),
          userId ? db.order.count({ where: { couponId: row.id, userId, OR: [{ status: "PAID" }, stillPending] } }) : 0,
        ])
      : [0, 0];
    const result = checkCoupon(
      row && { code: row.code, type: row.type, value: Number(row.value), minSubtotal: row.minSubtotal === null ? null : Number(row.minSubtotal), maxRedemptions: row.maxRedemptions, used: row.timesRedeemed + pending, startsAt: row.startsAt, endsAt: row.endsAt, isActive: row.isActive },
      subtotal,
      now,
    );
    if (result.ok && row && usedByBuyer === 0) {
      discount = result.discount;
      coupon = { id: row.id, code: row.code };
    } else {
      couponError = result.ok ? COUPON_INVALID : result.reason;
    }
  }

  return { ...totals({ subtotal, discount, feePercent: env.CHECKOUT_FEE_PERCENT }), items, currency, coupon, couponError };
}
