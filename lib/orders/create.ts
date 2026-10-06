import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { ProviderId } from "@/lib/payments/types";

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

/**
 * Creates a PENDING order for a signed-in buyer. The server decides everything that matters:
 *  - only the edition ids come from the browser; prices are read from the database right here
 *  - editions the buyer already owns are refused
 *  - each item snapshots unitPrice, so a later price change never rewrites history
 * Digital items are always quantity one.
 */
export async function createPendingOrder(input: { userId: string; editionIds: string[]; provider: ProviderId }) {
  const ids = [...new Set(input.editionIds)];
  if (ids.length === 0) throw new CheckoutError("EMPTY", "Your cart is empty.");
  if (ids.length > 10) throw new CheckoutError("TOO_MANY", "Too many items in one order.");

  const editions = await prisma.edition.findMany({
    where: { id: { in: ids }, isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } },
    include: { work: true },
  });
  if (editions.length !== ids.length) throw new CheckoutError("UNAVAILABLE", "One of the items is no longer available.", 409);

  const owned = await prisma.entitlement.findMany({ where: { userId: input.userId, editionId: { in: ids } }, select: { editionId: true } });
  if (owned.length > 0) {
    const titles = editions.filter((e) => owned.some((o) => o.editionId === e.id)).map((e) => e.title ?? e.work.title);
    throw new CheckoutError("ALREADY_OWNED", `You already own: ${titles.join(", ")}.`, 409);
  }

  const currency = editions[0].currency;
  if (editions.some((e) => e.currency !== currency)) throw new CheckoutError("UNAVAILABLE", "Items use different currencies.", 409);
  const total = editions.reduce((sum, e) => sum + Number(e.price), 0);

  const reference = input.provider === "PAYSTACK" ? newReference() : null; // M-Pesa's id comes back from Safaricom
  const order = await prisma.order.create({
    data: {
      userId: input.userId,
      status: "PENDING",
      totalAmount: total.toFixed(2),
      currency,
      provider: input.provider,
      providerReference: reference,
      items: { create: editions.map((e) => ({ editionId: e.id, quantity: 1, unitPrice: e.price, currency: e.currency })) },
    },
  });
  return { order, total, currency, titles: editions.map((e) => e.title ?? e.work.title) };
}
