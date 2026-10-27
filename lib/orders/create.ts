import { randomBytes } from "node:crypto";

import { buildQuote, PENDING_HOLD_MS } from "@/lib/checkout/quote";
import type { ProviderId } from "@/lib/payments/types";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/trace";

/** A unique, unguessable, URL-safe payment reference, e.g. WGC-m3k9x2-9f2a1c7e5b3d. */
const newReference = () => `WGC-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;

export interface PendingOrderInput {
  userId: string;
  editionIds: string[];
  /** Omit for a free order (total 0): no provider is involved. */
  provider?: ProviderId;
  coupon?: string | null;
  /** Guest checkout: hash of the paying device's secret, and whether this order created the account. */
  claimTokenHash?: string;
  accountCreated?: boolean;
  payerPhone?: string;
  /**
   * Hand back the buyer's own still-pending order for the same books instead of starting a second payment
   * (a second STK prompt is how a buyer ends up paying twice). Only safe for a signed-in buyer: for a guest
   * it would let a stranger who types someone's email block that person's checkout.
   */
  reusePending?: boolean;
}

/**
 * Creates a PENDING order. The server decides everything that matters:
 *  - only edition ids and a coupon code come from the browser; every price comes from buildQuote
 *  - editions the buyer already owns are refused
 *  - each item snapshots unitPrice, so a later price change never rewrites history
 * Digital items are always quantity one.
 * Everything runs in ONE transaction that first takes a per-buyer lock and (with a coupon) a lock on the coupon
 * row. Two checkouts racing for the last redemption, or double-clicking pay, are therefore decided one at a
 * time: the second one sees the first one's pending order.
 * Throws AppError: CHECKOUT_CART_EMPTY / TOO_MANY_ITEMS / ITEM_UNAVAILABLE, CHECKOUT_COUPON_INVALID (422),
 * CHECKOUT_ALREADY_OWNED (409), CHECKOUT_ORDER_PENDING (409).
 */
export async function createPendingOrder(input: PendingOrderInput) {
  const ids = [...new Set(input.editionIds)];

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.userId}))`;
    const code = input.coupon?.trim().toUpperCase();
    if (code) await tx.$executeRaw`SELECT 1 FROM "coupon" WHERE "code" = ${code} FOR UPDATE`;

    if (input.reusePending && input.provider) {
      const open = await tx.order.findFirst({
        where: { userId: input.userId, status: "PENDING", provider: input.provider, createdAt: { gt: new Date(Date.now() - PENDING_HOLD_MS) }, items: { some: { editionId: { in: ids } } } },
        include: { items: { include: { edition: { include: { work: true } } } } },
        orderBy: { createdAt: "desc" },
      });
      if (open) {
        const same = open.items.length === ids.length && open.items.every((i) => ids.includes(i.editionId));
        if (!same) throw new AppError("CHECKOUT_ORDER_PENDING", "You already have a payment in progress for one of these books. Finish it, or try again in 30 minutes.", 409);
        return { order: open, total: Number(open.totalAmount), currency: open.currency, titles: open.items.map((i) => i.edition.title ?? i.edition.work.title), reused: true };
      }
    }

    const quote = await buildQuote(ids, input.coupon, { userId: input.userId, db: tx });
    if (input.coupon && quote.couponError) throw new AppError("CHECKOUT_COUPON_INVALID", quote.couponError, 422);

    const owned = await tx.entitlement.findMany({ where: { userId: input.userId, editionId: { in: ids } }, select: { editionId: true } });
    if (owned.length > 0) {
      const titles = quote.items.filter((i) => owned.some((o) => o.editionId === i.editionId)).map((i) => i.title);
      throw new AppError("CHECKOUT_ALREADY_OWNED", `You already own: ${titles.join(", ")}.`, 409);
    }

    const reference = input.provider === "PAYSTACK" ? newReference() : null; // M-Pesa's id comes back from Safaricom
    const order = await tx.order.create({
      data: {
        userId: input.userId,
        status: "PENDING",
        totalAmount: quote.total.toFixed(2),
        subtotalAmount: quote.subtotal.toFixed(2),
        discountAmount: quote.discount.toFixed(2),
        feeAmount: quote.fee.toFixed(2),
        couponId: quote.coupon?.id,
        currency: quote.currency,
        provider: input.provider,
        providerReference: reference,
        payerPhone: input.payerPhone,
        claimTokenHash: input.claimTokenHash,
        accountCreated: input.accountCreated ?? false,
        items: { create: quote.items.map((i) => ({ editionId: i.editionId, quantity: 1, unitPrice: i.price.toFixed(2), currency: i.currency })) },
      },
    });
    return { order, total: quote.total, currency: quote.currency, titles: quote.items.map((i) => i.title), reused: false };
  });
}
