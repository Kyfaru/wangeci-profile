import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { enabledProviders } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** `/checkout`: signed-in, verified buyers only (the proxy is the front door, requireUser is the real check). */
export default async function CheckoutPage() {
  const user = await requireUser();
  const [saved, fullUser] = await Promise.all([
    prisma.cartItem.findMany({ where: { cart: { userId: user.id } }, select: { editionId: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { phoneNumber: true } }),
  ]);

  return <CheckoutClient savedEditionIds={saved.map((s) => s.editionId)} accountPhone={fullUser?.phoneNumber ?? null} methods={enabledProviders()} />;
}
