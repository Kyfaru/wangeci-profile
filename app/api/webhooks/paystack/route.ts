import { NextResponse } from "next/server";

import { applyProviderEvent } from "@/lib/orders/apply-event";
import { paystack } from "@/lib/payments/paystack";

// Webhook routes can be prerendered unless forced dynamic; this one only reads the raw request.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/paystack
 * Machines prove themselves with a signature (never a cookie). The signature covers the RAW body, so it
 * is checked before anything is parsed. Answers: 401 bad signature; 200 for everything a retry cannot
 * fix (unknown reference, amount mismatch, duplicates); 5xx ONLY when our database is down, because
 * then a Paystack retry is the cure.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!paystack.verifyWebhook(rawBody, request.headers)) {
    console.error("[webhooks/paystack] signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  try {
    await applyProviderEvent(paystack.parseEvent(payload));
  } catch (error) {
    console.error("[webhooks/paystack] processing failed", error);
    return NextResponse.json({ error: "Temporary failure" }, { status: 503 }); // ask Paystack to retry
  }
  return NextResponse.json({ received: true });
}
