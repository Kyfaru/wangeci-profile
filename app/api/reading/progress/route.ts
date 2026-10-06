import { NextResponse } from "next/server";
import { z } from "zod";

import { rateLimit } from "@/lib/rate-limit";
import { saveProgress } from "@/lib/reading/progress";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  editionId: z.string().min(1).max(64),
  chapterIdx: z.number().int().min(0).max(9999),
  // Word offset (text) or whole seconds (audio).
  offset: z.number().min(0).max(10_000_000),
});

/**
 * POST /api/reading/progress : saves the reader's place. Signed in, owns the book, rate limited.
 * Accepts the body as text so navigator.sendBeacon (which cannot set JSON headers) works on tab close.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let raw: unknown;
  try {
    raw = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (!(await rateLimit(`progress:${session.user.id}`, 40, "1 m")).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const result = await saveProgress({ userId: session.user.id, ...parsed.data, offset: Math.floor(parsed.data.offset) });
  if (result === "forbidden") return NextResponse.json({ error: "Not found" }, { status: 404 }); // do not reveal what exists
  if (result === "invalid") return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
