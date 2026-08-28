import { NextResponse } from "next/server";
import { Webhook, WebhookVerificationError } from "svix";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { NotificationStatus } from "@prisma/client";

// See app/api/webhooks/paystack/route.ts for why this is required — this
// handler would otherwise be eligible for Next.js's build-time static
// optimization, which would run it (and its env var reads) during the
// Docker build stage where secrets are intentionally absent.
export const dynamic = "force-dynamic";

/** Shape of the fields we read off a Resend (Svix-format) webhook payload. */
interface ResendWebhookPayload {
  type: string;
  data: {
    email_id: string;
  };
}

/**
 * Maps a Resend event type to the NotificationLog status it should record.
 * Every other event type (e.g. email.sent, email.opened) returns null and
 * is acknowledged as a no-op — full event list:
 * https://resend.com/docs/dashboard/webhooks/event-types
 * Spam complaints are treated as bounces — for suppression-list purposes we
 * want future sends to that address held back the same way an actual
 * bounce would, and NotificationStatus has no separate COMPLAINED value.
 */
function statusForEventType(eventType: string): NotificationStatus | null {
  switch (eventType) {
    case "email.delivered":
      return "DELIVERED";
    case "email.bounced":
    case "email.complained":
      return "BOUNCED";
    default:
      return null;
  }
}

/**
 * POST /api/webhooks/resend
 *
 * Handles Resend email delivery webhooks (delivered/bounced/complained),
 * verified via Svix's signing scheme, and updates the matching
 * NotificationLog row's status.
 * @returns 200 once handled/acknowledged, 401 if Svix signature
 *   verification fails, 400 if required Svix headers are missing.
 * Why it exists: lib/email.ts records a QUEUED/SENT NotificationLog row per
 * outbound email; this webhook is what advances that row to DELIVERED or
 * BOUNCED so the app knows whether a send actually reached the recipient.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RESEND_MISSING_SVIX_HEADERS",
          message: "Required Svix verification headers were missing.",
          details: {},
        },
      },
      { status: 400 },
    );
  }

  const webhook = new Webhook(env.RESEND_WEBHOOK_SECRET);

  let payload: ResendWebhookPayload;
  try {
    payload = webhook.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.error("[webhooks/resend] signature verification failed", { message: error.message });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESEND_INVALID_SIGNATURE",
            message: "Webhook signature verification failed.",
            details: {},
          },
        },
        { status: 401 },
      );
    }
    // Programmer error (unexpected shape/failure inside verify) — rethrow
    // so it surfaces loudly rather than being swallowed as a 401.
    throw error;
  }

  const status = statusForEventType(payload.type);
  const emailId = payload.data?.email_id;

  if (!status || !emailId) {
    // Event type we don't act on (e.g. email.sent, email.opened) — ack and
    // move on.
    return NextResponse.json({ received: true });
  }

  const log = await prisma.notificationLog.findUnique({
    where: { providerId: emailId },
  });

  // No matching log row is an anomaly (an email we never recorded sending),
  // not something retrying fixes — ack 200 and log for investigation.
  if (!log) {
    console.error("[webhooks/resend] no notification_log row for email id", { emailId });
    return NextResponse.json({ received: true });
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: { status },
  });

  return NextResponse.json({ received: true });
}
