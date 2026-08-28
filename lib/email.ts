import type { ReactElement } from "react";

import { Resend } from "resend";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const resend = new Resend(env.RESEND_API_KEY);

// No RESEND_FROM_EMAIL env var exists yet (lib/env.ts is owned by the
// foundation agent) — hardcoded here as a placeholder until a real sending
// domain is verified with Resend and a proper env var is added.
const DEFAULT_FROM_EMAIL = "Wangeci <onboarding@resend.dev>";

export interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  /** The user this notification is for, if any (e.g. omitted for system alerts). */
  userId?: string;
  /** e.g. "email-verification", "password-reset", "order-confirmation" — lets
   * the notification log and the Resend webhook handler filter by type. */
  purpose: string;
  from?: string;
}

/** Thrown when Resend rejects or fails to send an email. The notification_log
 * row is already marked FAILED before this is thrown — callers decide
 * whether that's fatal for their flow. */
export class EmailSendError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "EmailSendError";
  }
}

/**
 * Sends a transactional email via Resend and records it in notification_log.
 * @param params.to - recipient email address.
 * @param params.subject - email subject line.
 * @param params.react - the React Email component to render as the body.
 * @param params.userId - user this email is for, if any.
 * @param params.purpose - short machine-readable label for the notification type.
 * @param params.from - sender override; defaults to DEFAULT_FROM_EMAIL.
 * @returns the Resend message id on success.
 * @throws {EmailSendError} if Resend returns an error or the request fails —
 *   the failure is logged to notification_log (status FAILED) before throwing.
 * Why it exists: every outbound email needs a notification_log row so the
 * Resend delivery webhook (handled by another agent) can match bounces and
 * delivery confirmations back to what was sent and to whom.
 */
export async function sendEmail({
  to,
  subject,
  react,
  userId,
  purpose,
  from,
}: SendEmailParams): Promise<{ id: string }> {
  const log = await prisma.notificationLog.create({
    data: {
      channel: "EMAIL",
      status: "QUEUED",
      purpose,
      recipient: to,
      userId,
    },
  });

  const { data, error } = await resend.emails.send({
    from: from ?? DEFAULT_FROM_EMAIL,
    to,
    subject,
    react,
  });

  if (error || !data) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    // Programmer/operational split: a Resend API error (bad key, invalid
    // recipient) is operational — log with full context and let the caller
    // decide how to surface it, rather than swallowing it silently.
    console.error("[email] send failed", { purpose, to, error });
    throw new EmailSendError(
      error?.message ?? "Resend returned no data and no error",
      error,
    );
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: { status: "SENT", providerId: data.id },
  });

  return { id: data.id };
}
