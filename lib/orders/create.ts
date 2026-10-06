import { randomBytes } from "node:crypto";

import { buildQuote, QuoteError } from "@/lib/checkout/quote";
import type { ProviderId } from "@/lib/payments/types";
import { prisma } from "@/lib/prisma";

export class CheckoutError extends Error {
  constructor(
    readonly code: "EMPTY" | "UNAVAILABLE" | "ALREADY_OWNED" | "TOO_MANY",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

/** A unique, unguessable, URL-safe payment reference, e.g. WGC-m3k9x2-9f2a1c7e5b3d. */
export const newReference = () => `WGC-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;

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
}

/**
 * Creates a PENDING order. The server decides everything that matters:
 *  - only edition ids and a coupon code come from the browser; every price comes from buildQuote
 *  - editions the buyer already owns are refused
 *  - each item snapshots unitPrice, so a later price change never rewrites history
 * Digital items are always quantity one.
 */
export async function createPendingOrder(input: PendingOrderInput) {
  let quote;
  try {
    quote = await buildQuote(input.editionIds, input.coupon);
  } catch (error) {
    if (error instanceof QuoteError) throw new CheckoutError(error.code, error.message, error.status);
    throw error;
  }
  if (input.coupon && quote.couponError) throw new CheckoutError("UNAVAILABLE", quote.couponError, 422);

  const ids = quote.items.map((i) => i.editionId);
  const owned = await prisma.entitlement.findMany({ where: { userId: input.userId, editionId: { in: ids } }, select: { editionId: true } });
  if (owned.length > 0) {
    const titles = quote.items.filter((i) => owned.some((o) => o.editionId === i.editionId)).map((i) => i.title);
    throw new CheckoutError("ALREADY_OWNED", `You already own: ${titles.join(", ")}.`, 409);
  }

  const reference = input.provider === "PAYSTACK" ? newReference() : null; // M-Pesa's id comes back from Safaricom
  const order = await prisma.order.create({
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
  return { order, total: quote.total, currency: quote.currency, titles: quote.items.map((i) => i.title) };
}
