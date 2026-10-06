import { createElement } from "react";

import ReceiptEmail from "@/emails/receipt-email";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { orderPaid } from "@/lib/sms-templates";

export type Channel = "email" | "sms" | "in_app";

export type NotifyEvent =
  | { type: "order_paid"; orderId: string; titles: string[]; total: string; reference: string }
  | { type: "refund_completed"; orderId: string; titles: string[] }
  | { type: "new_chapter"; title: string; link: string };

/** Codes, receipts and refunds always go out. Everything else respects the person's choices. */
const TRANSACTIONAL = new Set<NotifyEvent["type"]>(["order_paid", "refund_completed"]);

/**
 * Sends one notification on the requested channels. Optional notices (new chapter) check
 * UserPreferences first; transactional ones never do. Every channel is attempted independently and
 * a failure on one never throws, so a broken email provider can never turn a webhook into an error.
 */
export async function notify(userId: string, event: NotifyEvent, channels: Channel[]): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phoneNumber: true, phoneNumberVerified: true, preferences: { select: { emailNotifications: true, smsNotifications: true } } },
  });
  if (!user) return;

  const transactional = TRANSACTIONAL.has(event.type);
  const wantsEmail = transactional || (user.preferences?.emailNotifications ?? true);
  const wantsSms = transactional || (user.preferences?.smsNotifications ?? true);

  const tasks: Promise<unknown>[] = [];

  if (channels.includes("email") && wantsEmail) {
    if (event.type === "order_paid") {
      tasks.push(sendEmail({ to: user.email, subject: "Your Wangeci order is confirmed", react: createElement(ReceiptEmail, { titles: event.titles, total: event.total, reference: event.reference }), userId, purpose: "order-paid" }));
    }
  }

  if (channels.includes("sms") && wantsSms && user.phoneNumber && user.phoneNumberVerified) {
    if (event.type === "order_paid") tasks.push(sendSms({ to: user.phoneNumber, message: orderPaid(event.titles[0] ?? "your book"), userId, purpose: "order-paid" }));
  }

  if (channels.includes("in_app")) {
    const [title, body, link, key] =
      event.type === "order_paid"
        ? ["Order confirmed", `${event.titles.join(", ")} is now in My Books.`, "/dashboard/books", `order-paid:${event.orderId}`]
        : event.type === "refund_completed"
          ? ["Refund completed", `Your refund for ${event.titles.join(", ")} has been processed.`, "/dashboard/books", `refund:${event.orderId}`]
          : ["New chapter", event.title, event.link, `chapter:${event.link}`];
    tasks.push(
      prisma.notificationLog.createMany({
        data: [{ userId, channel: "IN_APP", status: "DELIVERED", purpose: event.type, recipient: "in-app", title, body, link, dedupeKey: key }],
        skipDuplicates: true,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") console.error("[notify] a channel failed", event.type, r.reason);
}
