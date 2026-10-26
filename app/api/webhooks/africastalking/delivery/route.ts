import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { NotificationStatus } from "@prisma/client";
import { AppError, api, logError, safeEqual } from "@/lib/trace";

// Without this the route is eligible for build-time static optimisation, which would run it during the
// Docker build stage where secrets are intentionally absent.
export const dynamic = "force-dynamic";

// SECURITY NOTE: Africa's Talking does not sign delivery reports, so the callback URL registered in their
// dashboard carries a secret (AT_WEBHOOK_TOKEN). The token is read from the `x-webhook-token` header or,
// for the dashboard's plain URL field, from `?token=`. Prefer the header when the proxy can add one: query
// strings end up in access logs. A wrong or missing token gets a 401.

function hasValidToken(request: Request): boolean {
  const expected = env.AT_WEBHOOK_TOKEN;
  const given = request.headers.get("x-webhook-token") ?? new URL(request.url).searchParams.get("token");
  return Boolean(expected && given && safeEqual(expected, given));
}

/**
 * Maps an Africa's Talking delivery `status` to the NotificationLog status it should record. AT's
 * vocabulary is broader than NotificationStatus, so in-flight statuses ("Submitted", "Buffered") map to
 * null: a no-op ack.
 * Reference: https://developers.africastalking.com/docs/sms/callback/delivery-reports
 */
function statusForDeliveryStatus(status: string): NotificationStatus | null {
  switch (status) {
    case "Success":
      return "DELIVERED";
    case "Failed":
    case "Rejected":
    case "TimeOut":
    case "UserInBlacklist":
    case "InsufficientBalance":
      return "FAILED";
    default:
      return null;
  }
}

/**
 * POST /api/webhooks/africastalking/delivery: SMS delivery reports (form-encoded, not JSON) advance the
 * matching NotificationLog row from SENT to DELIVERED or FAILED.
 * Answers: 200 once handled or ignored, 401 bad token, 400 when `id` or `status` is missing.
 */
async function handlePOST(request: Request) {
  if (!hasValidToken(request)) throw new AppError("AT_UNAUTHORIZED", "Unauthorized.", 401);

  const form = await request.formData();
  const messageId = form.get("id");
  const status = form.get("status");

  if (typeof messageId !== "string" || typeof status !== "string") {
    throw new AppError("AT_MALFORMED_PAYLOAD", "Required fields 'id' and 'status' were missing from the delivery report.", 400);
  }

  const mappedStatus = statusForDeliveryStatus(status);
  if (!mappedStatus) return NextResponse.json({ received: true });

  const log = await prisma.notificationLog.findUnique({ where: { providerId: messageId } });

  // A message we never recorded sending is an anomaly a retry cannot fix: acknowledge it and leave a trace.
  if (!log) {
    logError("webhooks.africastalking.unknown_message", new AppError("AT_UNKNOWN_MESSAGE", "No notification log row for this message id.", 404, { messageId }));
    return NextResponse.json({ received: true });
  }

  await prisma.notificationLog.update({ where: { id: log.id }, data: { status: mappedStatus } });
  return NextResponse.json({ received: true });
}

export const POST = api("webhooks.africastalking.delivery.post", handlePOST);
