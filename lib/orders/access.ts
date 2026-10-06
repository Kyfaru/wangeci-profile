import { timingSafeEqual } from "node:crypto";

import { hashToken } from "@/lib/checkout/guest";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";

const include = {
  user: { select: { name: true, email: true, phoneNumber: true } },
  coupon: { select: { code: true } },
  items: { include: { edition: { include: { work: { select: { title: true, slug: true } } } } } },
} as const;

/**
 * Finds an order (by id or payment reference) for someone allowed to see it:
 *  - the signed-in owner, or
 *  - the paying device, which holds the secret token given at checkout (a guest has no session yet).
 * Anyone else gets null, which callers answer exactly like "not found".
 */
export async function findOrderForViewer(idOrReference: string, token: string | null) {
  const order = await prisma.order.findFirst({ where: { OR: [{ id: idOrReference }, { providerReference: idOrReference }] }, include });
  if (!order) return null;

  const session = await getSession();
  if (session && session.user.id === order.userId) return { order, signedIn: true };

  if (token && order.claimTokenHash) {
    const a = Buffer.from(hashToken(token));
    const b = Buffer.from(order.claimTokenHash);
    if (a.length === b.length && timingSafeEqual(a, b)) return { order, signedIn: Boolean(session && session.user.id === order.userId) };
  }
  return null;
}

export type ViewableOrder = NonNullable<Awaited<ReturnType<typeof findOrderForViewer>>>["order"];
export { include as orderViewInclude };
