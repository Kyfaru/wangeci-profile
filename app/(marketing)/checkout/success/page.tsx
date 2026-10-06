import type { Metadata } from "next";

import { SuccessPoller } from "@/components/checkout/SuccessPoller";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Payment status", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * `/checkout/success?ref=`: only a thank-you page. Landing here proves nothing: the poller shows
 * what the SERVER says about the order (confirmed by the payment provider), never what the URL says.
 */
export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  await requireUser();
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 80) : "";
  return <SuccessPoller reference={ref} />;
}
