"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";

const schema = z.object({ emailNotifications: z.boolean(), smsNotifications: z.boolean() });

/** Saves the person's optional-notice choices. Receipts, codes and refunds are always sent regardless. */
export async function updatePreferences(input: { emailNotifications: boolean; smsNotifications: boolean }): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };
  await prisma.userPreferences.upsert({ where: { userId: session.user.id }, create: { userId: session.user.id, ...parsed.data }, update: parsed.data });
  return { ok: true };
}
