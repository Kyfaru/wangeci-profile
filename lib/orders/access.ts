import { timingSafeEqual } from "node:crypto";

import { hashToken } from "@/lib/checkout/guest";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";

const include = {
  user: { select: { name: true, email: true, phoneNumber: true } },
  coupon: { select: { code: true } },
  items: { include: { edition: { include: { work: { select: { title: true, slug: true } } } } } },
} as const;

/** The order token is a short-lived read capability for the paying device, not a standing key. */
const TOKEN_READ_WINDOW_MS = 24 * 3_600_000;

/** The token travels in this header, never in the URL (URLs end up in logs, history and referrers). */
export const ORDER_TOKEN_HEADER = "x-order-token";

/**
 * Finds an order (by id or payment reference) for someone allowed to see it:
 *  - the signed-in owner (signedIn: true, may see everything), or
 *  - the paying device, which holds the secret token given at checkout (a guest has no session yet) for
 *    24 hours (signedIn: false: callers must mask the account's personal details).
 * Anyone else gets null, which callers answer exactly like "not found".
 */
export async function findOrderForViewer(idOrReference: string, token: string | null) {
  const order = await prisma.order.findFirst({ where: { OR: [{ id: idOrReference }, { providerReference: idOrReference }] }, include });
  if (!order) return null;

  const session = await getSession();
  if (session && session.user.id === order.userId) return { order, signedIn: true };

  if (token && order.claimTokenHash && Date.now() - order.createdAt.getTime() <= TOKEN_READ_WINDOW_MS) {
    const a = Buffer.from(hashToken(token));
    const b = Buffer.from(order.claimTokenHash);
    if (a.length === b.length && timingSafeEqual(a, b)) return { order, signedIn: false };
  }
  return null;
}

export type ViewableOrder = NonNullable<Awaited<ReturnType<typeof findOrderForViewer>>>["order"];
export { include as orderViewInclude };
