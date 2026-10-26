import { prisma } from "@/lib/prisma";
import { traced } from "@/lib/trace";

export type NotifyEvent =
  | { type: "order_paid"; orderId: string; titles: string[]; total: string; reference: string }
  | { type: "refund_completed"; orderId: string; titles: string[] }
  | { type: "new_chapter"; title: string; link: string };

/**
 * Puts one item in a person's notification bell (the dashboard "notifications" page). Email and SMS for
 * paid orders are sent by post-paid.ts, not here. Never throws: a failure is traced, so a broken bell can
 * never turn a webhook into an error. Retries are harmless: the dedupe key makes the row unique per event.
 */
export async function notify(userId: string, event: NotifyEvent): Promise<void> {
  const [title, body, link, key] =
    event.type === "order_paid"
      ? ["Order confirmed", `${event.titles.join(", ")} is now in My Books.`, "/dashboard/books", `order-paid:${event.orderId}`]
      : event.type === "refund_completed"
        ? ["Refund completed", `Your refund for ${event.titles.join(", ")} has been processed.`, "/dashboard/books", `refund:${event.orderId}`]
        : ["New chapter", event.title, event.link, `chapter:${event.link}`];

  await traced(
    "notify.bell",
    () =>
      prisma.notificationLog.createMany({
        data: [{ userId, channel: "IN_APP", status: "DELIVERED", purpose: event.type, recipient: "in-app", title, body, link, dedupeKey: key }],
        skipDuplicates: true,
      }),
    { type: event.type, userId },
  );
}
