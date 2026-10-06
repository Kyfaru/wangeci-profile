import { Client } from "@upstash/qstash";
import { createElement } from "react";

import OtpEmail from "@/emails/otp-email";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";
import { otp as otpSmsText } from "@/lib/sms-templates";

export interface OtpJob {
  channel: "email" | "sms";
  to: string;
  code: string;
}

/** Actually delivers one code. Called by the queue worker, or directly when no queue is configured. */
export async function deliverOtp({ channel, to, code }: OtpJob): Promise<void> {
  if (env.NODE_ENV !== "production") {
    // Local development only: lets you sign in without a working email or SMS provider.
    console.info(`[dev] one-time code for ${to}: ${code}`);
  }
  if (channel === "email") {
    await sendEmail({ to, subject: "Your Wangeci code", react: createElement(OtpEmail, { code }), purpose: "otp" });
  } else {
    await sendSms({ to, message: otpSmsText(code), purpose: "otp" });
  }
}

/**
 * Hands a code to QStash (a message queue) so slow email/SMS providers never block the sign-in request,
 * and failed sends are retried for us. Without QStash configured (local development) it sends directly.
 * Note: the code travels in the queue message body, so it passes through Upstash. It expires in 5 minutes.
 */
export async function dispatchOtp(job: OtpJob): Promise<void> {
  if (!env.QSTASH_TOKEN) {
    await deliverOtp(job).catch((error) => console.error("[otp] direct send failed", error));
    return;
  }
  const client = new Client({ token: env.QSTASH_TOKEN });
  await client.publishJSON({ url: `${env.BETTER_AUTH_URL}/api/qstash/send-otp`, body: job, retries: 3 });
}
