import type { Metadata } from "next";

import { SuccessView } from "@/components/checkout/SuccessView";

export const metadata: Metadata = { title: "Payment status", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * `/checkout/success?ref=`: only a thank-you page. Landing here proves nothing: the view shows what the
 * SERVER says about the order (confirmed by the payment provider), never what the URL says. A guest has no
 * session yet, so the view also sends the secret the paying device kept in sessionStorage.
 */
export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 80) : "";
  return <SuccessView reference={ref} />;
}
