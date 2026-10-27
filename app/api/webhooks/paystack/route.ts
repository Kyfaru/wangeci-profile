import { NextResponse } from "next/server";

import { applyProviderEvent } from "@/lib/orders/apply-event";
import { paystack } from "@/lib/payments/paystack";
import { AppError, api, logError } from "@/lib/trace";

// Webhook routes can be prerendered unless forced dynamic; this one only reads the raw request.
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/paystack
 * Machines prove themselves with a signature (never a cookie). The signature covers the RAW body, so it
 * is checked before anything is parsed. Answers: 401 bad signature; 200 for everything a retry cannot
 * fix (unknown reference, amount mismatch, duplicates); 5xx ONLY when our database is down, because
 * then a Paystack retry is the cure.
 */
async function handlePOST(request: Request) {
  const rawBody = await request.text();

  if (!paystack.verifyWebhook(rawBody, request.headers)) {
    throw new AppError("PAYSTACK_BAD_SIGNATURE", "Invalid signature", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new AppError("PAYSTACK_BAD_PAYLOAD", "Malformed payload", 400);
  }

  try {
    await applyProviderEvent(paystack.parseEvent(payload));
  } catch (error) {
    logError("webhooks.paystack", error);
    return NextResponse.json({ error: "Temporary failure" }, { status: 503 }); // ask Paystack to retry
  }
  return NextResponse.json({ received: true });
}

export const POST = api("webhooks.paystack.post", handlePOST);
