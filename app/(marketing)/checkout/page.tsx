import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { enabledProviders } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** `/checkout`: open to guests (an account is created from their details) and to signed-in readers. */
export default async function CheckoutPage() {
  const session = await getSession();
  const saved = session ? await prisma.cartItem.findMany({ where: { cart: { userId: session.user.id } }, select: { editionId: true } }) : [];

  return (
    <CheckoutClient
      savedEditionIds={saved.map((s) => s.editionId)}
      signedIn={session ? { name: session.user.name, email: session.user.email, phone: session.user.phoneNumber ?? null } : null}
      methods={enabledProviders()}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
    />
  );
}
