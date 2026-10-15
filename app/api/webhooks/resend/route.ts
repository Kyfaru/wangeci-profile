import { NextResponse } from "next/server";
import { Webhook, WebhookVerificationError } from "svix";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { NotificationStatus } from "@prisma/client";
import { AppError, api, logError } from "@/lib/trace";

// Without this the route is eligible for build-time static optimisation, which would run it (and its env
// reads) during the Docker build stage where secrets are intentionally absent.
export const dynamic = "force-dynamic";

/** Shape of the fields we read off a Resend (Svix-format) webhook payload. */
interface ResendWebhookPayload {
  type: string;
  data: {
    email_id: string;
  };
}

/**
 * Maps a Resend event type to the NotificationLog status it should record. Every other event type
 * (email.sent, email.opened ...) returns null and is acknowledged as a no-op.
 * Spam complaints are treated as bounces: future sends to that address are held back the same way, and
 * NotificationStatus has no separate COMPLAINED value.
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
 * POST /api/webhooks/resend: email delivery webhooks (delivered/bounced/complained), verified with Svix's
 * signing scheme, advance the matching NotificationLog row from SENT to DELIVERED or BOUNCED.
 * Answers: 200 once handled or ignored, 401 bad signature, 400 missing Svix headers.
 */
async function handlePOST(request: Request) {
  const rawBody = await request.text();

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new AppError("RESEND_MISSING_SVIX_HEADERS", "Required Svix verification headers were missing.", 400);
  }

  let payload: ResendWebhookPayload;
  try {
    payload = new Webhook(env.RESEND_WEBHOOK_SECRET).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookPayload;
  } catch (error) {
    // Anything but a verification failure is a bug in verify itself: let it surface as a 500, not a 401.
    if (!(error instanceof WebhookVerificationError)) throw error;
    throw new AppError("RESEND_INVALID_SIGNATURE", "Webhook signature verification failed.", 401);
  }

  const status = statusForEventType(payload.type);
  const emailId = payload.data?.email_id;
  if (!status || !emailId) return NextResponse.json({ received: true });

  const log = await prisma.notificationLog.findUnique({ where: { providerId: emailId } });

  // An email we never recorded sending is an anomaly a retry cannot fix: acknowledge it and leave a trace.
  if (!log) {
    logError("webhooks.resend.unknown_email", new AppError("RESEND_UNKNOWN_EMAIL", "No notification log row for this email id.", 404, { emailId }));
    return NextResponse.json({ received: true });
  }

  await prisma.notificationLog.update({ where: { id: log.id }, data: { status } });
  return NextResponse.json({ received: true });
}

export const POST = api("webhooks.resend.post", handlePOST);
