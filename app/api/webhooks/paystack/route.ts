import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// Route handlers with no dynamic API usage can be statically optimized (run
// once at `next build` time and cached) by Next.js's App Router. This route
// only ever reads the raw request body — nothing that would naturally opt it
// out of that — so it must be forced dynamic explicitly. Without this, the
// Docker build stage (which runs with no secrets available, by design) would
// crash trying to execute this handler at build time.
export const dynamic = "force-dynamic";

/** Shape of the fields we read off a Paystack webhook payload. Paystack sends
 * many more fields per event; we only declare what this handler touches. */
interface PaystackWebhookPayload {
  event: string;
  data: {
    reference: string;
  };
}

/**
 * Verifies a Paystack webhook's HMAC-SHA512 signature against the raw
 * request body.
 * @param rawBody - the exact bytes Paystack sent, unparsed.
 * @param signatureHeader - the `x-paystack-signature` header value.
 * @returns true if the signature is valid, false otherwise.
 * Why it exists: Paystack signs the raw byte sequence it sent, not a
 * re-serialized version of the parsed JSON, so verification must happen
 * before any JSON.parse — parsing then re-stringifying can produce a
 * different byte sequence (key order, whitespace) and break the signature.
 */
function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signatureHeader, "hex");

  // timingSafeEqual throws (rather than returning false) on mismatched
  // buffer lengths, so the length check must happen first — an attacker
  // sending a short/garbled header would otherwise crash the handler.
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * POST /api/webhooks/paystack
 *
 * Handles Paystack payment webhooks. On `charge.success`, marks the
 * matching Order PAID and grants an Entitlement for each edition on the
 * order.
 * @returns 200 once the event is acknowledged (including "nothing to do"
 *   cases we intentionally no-op on, so Paystack doesn't retry-storm us),
 *   401 if the signature doesn't verify, 500 only for genuine unexpected
 *   failures (e.g. the database is unreachable) — where a Paystack retry
 *   is actually the desired recovery path.
 * Why it exists: Paystack is the source of truth for whether a charge
 * succeeded; entitlements must never be granted before payment is
 * confirmed server-to-server.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-paystack-signature");

  if (!isValidSignature(rawBody, signatureHeader)) {
    console.error("[webhooks/paystack] signature verification failed");
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYSTACK_INVALID_SIGNATURE",
          message: "Webhook signature verification failed.",
          details: {},
        },
      },
      { status: 401 },
    );
  }

  let payload: PaystackWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  } catch {
    // Signature was valid but the body isn't JSON — this should never
    // happen for a genuine Paystack request. 400 (not 500) since this is
    // an operational/malformed-input condition, not a server failure.
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PAYSTACK_MALFORMED_PAYLOAD",
          message: "Webhook payload was not valid JSON.",
          details: {},
        },
      },
      { status: 400 },
    );
  }

  const reference = payload.data?.reference;

  // We only act on charge.success here. Every other event type (e.g.
  // charge.failed, refund.processed) is acknowledged with 200 and no-op'd —
  // Paystack only cares that we received it, and inventing handling for
  // events outside this task's scope risks silently wrong business logic.
  // TODO: handle charge.failed (mark Order FAILED) and refund events (mark
  // Order REFUNDED, revoke entitlements) once refund/partial-refund rules
  // are specified.
  if (payload.event !== "charge.success" || !reference) {
    return NextResponse.json({ received: true });
  }

  const order = await prisma.order.findUnique({
    where: { paystackReference: reference },
    include: { items: true },
  });

  // No matching order is an anomaly (a reference we never issued), but it's
  // not something retrying will fix — ack 200 and log for investigation
  // rather than causing Paystack to retry-storm us indefinitely.
  if (!order) {
    console.error("[webhooks/paystack] no order found for reference", { reference });
    return NextResponse.json({ received: true });
  }

  // Idempotency: a redelivered webhook for an already-processed order is a
  // no-op. This check plus the Entitlement upsert below (keyed on the
  // [userId, editionId] unique constraint) together make retried deliveries
  // safe.
  if (order.status === "PAID") {
    return NextResponse.json({ received: true });
  }

  // TODO: pricing edge cases (partial payment, amount mismatch vs
  // order.totalAmount, currency mismatch) aren't validated here — full
  // order/pricing reconciliation isn't specified yet.
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });

    for (const item of order.items) {
      await tx.entitlement.upsert({
        where: {
          userId_editionId: { userId: order.userId, editionId: item.editionId },
        },
        create: {
          userId: order.userId,
          editionId: item.editionId,
          orderId: order.id,
        },
        // Already entitled (e.g. a comp grant, or a retried webhook) —
        // nothing to change.
        update: {},
      });
    }
  });

  return NextResponse.json({ received: true });
}
