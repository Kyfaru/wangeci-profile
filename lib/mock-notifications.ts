/**
 * Mock notification fixtures, scoped by userId (see lib/mock-user.ts).
 */

export type NotificationType =
  | "new-chapter"
  | "order-update"
  | "reply"
  | "milestone"
  | "announcement";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "ntf_1",
    userId: "usr_1",
    type: "new-chapter",
    title: "New chapter available",
    message:
      "\"Letters to the Woman Rebuilding\" just added Letter Two: To the Woman Who Hasn't Told Anyone Yet.",
    read: false,
    createdAt: "2026-08-25T07:00:00.000Z",
    link: "/reader?editionId=letters-ebook-v1&idx=1",
  },
  {
    id: "ntf_2",
    userId: "usr_1",
    type: "order-update",
    title: "Order confirmed",
    message: "Your order for The Shea Ledger (ebook) has been confirmed.",
    read: false,
    createdAt: "2026-08-22T14:12:00.000Z",
    link: "/dashboard/orders",
  },
  {
    id: "ntf_3",
    userId: "usr_1",
    type: "milestone",
    title: "Halfway there",
    message: "You're 42% through From Pieces To Power. Keep going!",
    read: true,
    createdAt: "2026-08-20T18:35:00.000Z",
    link: "/reader?editionId=fptp-ebook-v1&idx=2",
  },
  {
    id: "ntf_4",
    userId: "usr_1",
    type: "reply",
    title: "Wangechi replied to your comment",
    message:
      "\"Thank you for sharing that — it means more than you know.\"",
    read: true,
    createdAt: "2026-08-10T09:20:00.000Z",
  },
  {
    id: "ntf_5",
    userId: "usr_1",
    type: "announcement",
    title: "The Rebuild Retreat 2026 registration is open",
    message:
      "Early-bird pricing for this year's in-person retreat ends September 30th.",
    read: true,
    createdAt: "2026-08-05T09:00:00.000Z",
    link: "/businesses/the-rebuild-collective",
  },
];

export function getNotificationsForUser(userId: string): Notification[] {
  return MOCK_NOTIFICATIONS.filter((n) => n.userId === userId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getUnreadCountForUser(userId: string): number {
  return MOCK_NOTIFICATIONS.filter((n) => n.userId === userId && !n.read)
    .length;
}
