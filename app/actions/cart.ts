"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";

const idsSchema = z.array(z.string().min(1).max(64)).max(10);

/**
 * Merges the browser cart (a shopping list) into the account's saved cart after sign-in.
 * Rule: one line per edition (no duplicates), quantity always one, editions the person already owns
 * or that are no longer for sale are dropped. Safe to run any number of times.
 */
export async function mergeCart(editionIds: string[]): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const parsed = idsSchema.safeParse(editionIds);
  if (!parsed.success || parsed.data.length === 0) return;

  const userId = session.user.id;
  const [editions, owned] = await Promise.all([
    prisma.edition.findMany({ where: { id: { in: parsed.data }, isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } }, select: { id: true } }),
    prisma.entitlement.findMany({ where: { userId, editionId: { in: parsed.data } }, select: { editionId: true } }),
  ]);
  const ownedIds = new Set(owned.map((o) => o.editionId));
  const wanted = editions.map((e) => e.id).filter((id) => !ownedIds.has(id));
  if (wanted.length === 0) return;

  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  await prisma.cartItem.createMany({ data: wanted.map((editionId) => ({ cartId: cart.id, editionId, quantity: 1 })), skipDuplicates: true });
}
