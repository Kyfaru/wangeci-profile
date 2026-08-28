import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// E.164: leading +, then 10-15 digits total (country code + subscriber
// number), no spaces/dashes — this is the exact format Africa's Talking
// requires for the `to` field.
const E164_REGEX = /^\+\d{10,15}$/;

const AT_BASE_URL =
  env.NODE_ENV === "production"
    ? "https://api.africastalking.com"
    : "https://api.sandbox.africastalking.com";

interface AfricasTalkingRecipient {
  statusCode: number;
  number: string;
  status: string;
  cost: string;
  messageId: string;
}

interface AfricasTalkingResponse {
  SMSMessageData: {
    Message: string;
    Recipients: AfricasTalkingRecipient[];
  };
}

export interface SendSmsParams {
  to: string;
  message: string;
  /** The user this notification is for, if any. */
  userId?: string;
  /** e.g. "otp", "order-paid", "order-pending" — lets the notification log
   * filter by notification type. */
  purpose: string;
  /** Overrides env.AT_SENDER_ID for this send. */
  senderId?: string;
}

/** Thrown for a malformed recipient number (checked before any DB write or
 * network call) or when Africa's Talking rejects/fails to deliver the
 * message. In the latter case the notification_log row is already marked
 * FAILED before this is thrown. */
export class SmsSendError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SmsSendError";
  }
}

/**
 * Sends an SMS via Africa's Talking and records it in notification_log.
 * @param params.to - recipient phone number, must be E.164 (e.g. +254712345678).
 * @param params.message - SMS body text.
 * @param params.userId - user this SMS is for, if any.
 * @param params.purpose - short machine-readable label for the notification type.
 * @param params.senderId - sender ID override; defaults to env.AT_SENDER_ID.
 * @returns the Africa's Talking message id on success.
 * @throws {SmsSendError} if `to` isn't E.164, or if Africa's Talking rejects
 *   the send — the latter is logged to notification_log (status FAILED)
 *   before throwing.
 * Why it exists: OTPs and order-status texts need a delivery record so
 * support can answer "did the customer actually get this?" without
 * screen-sharing the Africa's Talking dashboard.
 */
export async function sendSms({
  to,
  message,
  userId,
  purpose,
  senderId,
}: SendSmsParams): Promise<{ id: string }> {
  // Validate before any DB write — an invalid number is a caller bug, not a
  // delivery failure worth logging as a QUEUED notification attempt.
  if (!E164_REGEX.test(to)) {
    throw new SmsSendError(`Invalid phone number format: "${to}" — expected E.164 (e.g. +254712345678)`);
  }

  const log = await prisma.notificationLog.create({
    data: {
      channel: "SMS",
      status: "QUEUED",
      purpose,
      recipient: to,
      userId,
    },
  });

  const body = new URLSearchParams({
    username: env.AT_USERNAME,
    to,
    message,
    from: senderId ?? env.AT_SENDER_ID,
  });

  let recipient: AfricasTalkingRecipient | undefined;
  try {
    const res = await fetch(`${AT_BASE_URL}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey: env.AT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Africa's Talking responded ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as AfricasTalkingResponse;
    recipient = data.SMSMessageData?.Recipients?.[0];

    // AT returns HTTP 200/201 even when the individual recipient failed
    // (e.g. insufficient balance, blacklisted number) — the real result is
    // per-recipient statusCode, not the HTTP status.
    if (!recipient || recipient.statusCode !== 101) {
      throw new Error(recipient?.status ?? "Africa's Talking rejected the message");
    }
  } catch (error) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: "FAILED" },
    });
    console.error("[sms] send failed", { purpose, to, error });
    throw new SmsSendError(
      error instanceof Error ? error.message : "Africa's Talking send failed",
      error,
    );
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: { status: "SENT", providerId: recipient.messageId },
  });

  return { id: recipient.messageId };
}
