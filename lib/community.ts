import { getBookBySlug } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { notifyAdmins } from "@/lib/server/notify-admins";
import { AppError, traced } from "@/lib/trace";

// Reader comments and feedback (the admin side lives in lib/admin/actions.ts).
export const COMMENT_MAX_CHARS = 1000; // keeps one comment readable and the moderation queue scannable
export const FEEDBACK_MAX_CHARS = 2000;
const COMMENTS_PER_USER_PER_HOUR = 5; // a real reader rarely posts more; stops a flood from one account
const COMMUNITY_PER_IP_PER_HOUR = 20; // several readers may share one IP (office, mobile carrier)

/** Same limits for comments and feedback: per signed-in user and per IP. */
async function communityRateLimit(userId: string, ip: string, kind: "comment" | "feedback") {
  const [byUser, byIp] = await Promise.all([
    rateLimit(`community:${kind}:user:${userId}`, COMMENTS_PER_USER_PER_HOUR, "1 h"),
    rateLimit(`community:${kind}:ip:${ip}`, COMMUNITY_PER_IP_PER_HOUR, "1 h"),
  ]);
  if (!byUser.ok || !byIp.ok) throw new AppError("COMMUNITY_RATE_LIMITED", "You are posting too fast. Please try again later.", 429);
}

/** A signed-in reader's comment on a book. Starts PENDING: nobody sees it until an admin approves it. */
export async function submitComment(input: { userId: string; ip: string; slug: string; body: string }): Promise<{ id: string }> {
  await communityRateLimit(input.userId, input.ip, "comment");
  if (!(await getBookBySlug(input.slug))) throw new AppError("COMMUNITY_BOOK_NOT_FOUND", "That book was not found.", 404);
  const comment = await prisma.comment.create({ data: { userId: input.userId, postSlug: input.slug, body: input.body, status: "PENDING" } });
  await traced("community.notify", () =>
    notifyAdmins({ type: "comment_pending", title: "New comment to review", body: input.body.slice(0, 200), link: "/admin/comments", dedupeKey: `comment:${comment.id}` }),
  );
  return { id: comment.id };
}

/** Feedback (rating 1-5 optional, plus a message) about a book page. */
export async function submitFeedback(input: { userId: string; ip: string; slug: string; rating?: number | null; message: string }): Promise<{ id: string }> {
  await communityRateLimit(input.userId, input.ip, "feedback");
  if (!(await getBookBySlug(input.slug))) throw new AppError("COMMUNITY_BOOK_NOT_FOUND", "That book was not found.", 404);
  const row = await prisma.feedback.create({ data: { userId: input.userId, page: `/store/${input.slug}`, rating: input.rating ?? null, message: input.message } });
  await traced("community.notify", () =>
    notifyAdmins({ type: "feedback_new", title: "New reader feedback", body: input.message.slice(0, 200), link: "/admin/comments", dedupeKey: `feedback:${row.id}` }),
  );
  return { id: row.id };
}

