/**
 * Mock activity feed fixtures — a chronological log of account activity
 * shown on the dashboard, scoped by userId (see lib/mock-user.ts).
 */

export type ActivityType =
  | "purchase"
  | "reading-milestone"
  | "listening-milestone"
  | "bookmark"
  | "review";

export interface ActivityEntry {
  id: string;
  userId: string;
  type: ActivityType;
  message: string;
  createdAt: string;
  meta?: Record<string, string | number>;
}

export const MOCK_ACTIVITY: ActivityEntry[] = [
  {
    id: "act_1",
    userId: "usr_1",
    type: "bookmark",
    message: "Bookmarked Chapter 2: The Register at Fechi's",
    createdAt: "2026-08-25T18:00:00.000Z",
    meta: { bookSlug: "from-pieces-to-power", chapterIdx: 2 },
  },
  {
    id: "act_2",
    userId: "usr_1",
    type: "reading-milestone",
    message: "Reached 42% through From Pieces To Power",
    createdAt: "2026-08-20T18:32:00.000Z",
    meta: { bookSlug: "from-pieces-to-power", progressPercent: 42 },
  },
  {
    id: "act_3",
    userId: "usr_1",
    type: "purchase",
    message: "Purchased The Shea Ledger (ebook edition)",
    createdAt: "2026-06-01T11:04:00.000Z",
    meta: { bookSlug: "the-shea-ledger", price: 1500, currency: "KES" },
  },
  {
    id: "act_4",
    userId: "usr_1",
    type: "review",
    message: "Left a 5-star review for From Pieces To Power",
    createdAt: "2026-04-18T09:22:00.000Z",
    meta: { bookSlug: "from-pieces-to-power", rating: 5 },
  },
  {
    id: "act_5",
    userId: "usr_1",
    type: "listening-milestone",
    message: "Started listening to From Pieces To Power (audiobook)",
    createdAt: "2026-03-30T20:10:00.000Z",
    meta: { bookSlug: "from-pieces-to-power" },
  },
];

export function getActivityForUser(userId: string): ActivityEntry[] {
  return MOCK_ACTIVITY.filter((a) => a.userId === userId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
