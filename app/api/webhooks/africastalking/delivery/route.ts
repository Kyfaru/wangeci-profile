import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { NotificationStatus } from "@prisma/client";

// See app/api/webhooks/paystack/route.ts for why this is required — this
// handler would otherwise be eligible for Next.js's build-time static
// optimization, which would run it during the Docker build stage where
// secrets are intentionally absent.
export const dynamic = "force-dynamic";

// SECURITY NOTE: Africa's Talking does not sign delivery reports, so the callback URL
// registered in their dashboard carries a secret: /api/webhooks/africastalking/delivery?token=...
// (AT_WEBHOOK_TOKEN). A wrong or missing token gets a 401. Phase 6 adds an IP allowlist at the proxy.

function hasValidToken(request: Request): boolean {
  const expected = process.env.AT_WEBHOOK_TOKEN;
  const given = new URL(request.url).searchParams.get("token");
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Maps an Africa's Talking delivery `status` value to the NotificationLog
 * status it should record. AT's status vocabulary is broader than our
 * NotificationStatus enum, so unrecognized/in-flight statuses (e.g.
 * "Submitted", "Buffered") intentionally map to null — a no-op ack.
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
 * POST /api/webhooks/africastalking/delivery
 *
 * Handles Africa's Talking SMS delivery report callbacks and updates the
 * matching NotificationLog row's status. AT posts these as
 * application/x-www-form-urlencoded, not JSON.
 * @returns 200 once handled/acknowledged, 400 if the required `id`/`status`
 *   fields are missing from the form body.
 * Why it exists: lib/sms.ts records a QUEUED/SENT NotificationLog row per
 * outbound SMS; this webhook is what advances that row to DELIVERED or
 * FAILED so the app knows whether the text actually reached the recipient.
 */
export async function POST(request: Request) {
  if (!hasValidToken(request)) {
    console.error("[webhooks/africastalking] bad or missing token");
    return NextResponse.json(
      { success: false, error: { code: "AT_UNAUTHORIZED", message: "Unauthorized.", details: {} } },
      { status: 401 },
    );
  }

  const form = await request.formData();

  const messageId = form.get("id");
  const status = form.get("status");

  if (typeof messageId !== "string" || typeof status !== "string") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "AT_MALFORMED_PAYLOAD",
          message: "Required fields 'id' and 'status' were missing from the delivery report.",
          details: {},
        },
      },
      { status: 400 },
    );
  }

  const mappedStatus = statusForDeliveryStatus(status);

  if (!mappedStatus) {
    // In-flight or unrecognized status — nothing to record yet, ack and move on.
    return NextResponse.json({ received: true });
  }

  const log = await prisma.notificationLog.findUnique({
    where: { providerId: messageId },
  });

  // No matching log row is an anomaly (a message id we never recorded
  // sending), not something retrying fixes — ack 200 and log for
  // investigation.
  if (!log) {
    console.error("[webhooks/africastalking] no notification_log row for message id", { messageId });
    return NextResponse.json({ received: true });
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: { status: mappedStatus },
  });

  return NextResponse.json({ received: true });
}
