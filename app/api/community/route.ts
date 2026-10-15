import { NextResponse } from "next/server";
import { z } from "zod";

import { COMMENT_MAX_CHARS, FEEDBACK_MAX_CHARS, submitComment, submitFeedback } from "@/lib/community";
import { getSessionUserId } from "@/lib/server/session";
import { api, AppError } from "@/lib/trace";

export const dynamic = "force-dynamic";

const slug = z.string().trim().min(1).max(200);
const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("comment"), slug, body: z.string().trim().min(2).max(COMMENT_MAX_CHARS) }),
  z.object({ kind: z.literal("feedback"), slug, rating: z.number().int().min(1).max(5).optional(), message: z.string().trim().min(2).max(FEEDBACK_MAX_CHARS) }),
]);

/** POST /api/community: a signed-in reader sends a comment (held for review) or feedback about a book. */
async function handlePOST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) throw new AppError("AUTH_REQUIRED", "Please sign in to do that.", 401);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("COMMUNITY_INVALID", "Please check what you wrote and try again.", 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const data = parsed.data;
  if (data.kind === "comment") await submitComment({ userId, ip, slug: data.slug, body: data.body });
  else await submitFeedback({ userId, ip, slug: data.slug, rating: data.rating, message: data.message });
  return NextResponse.json({ ok: true });
}

export const POST = api("community.post", handlePOST);

