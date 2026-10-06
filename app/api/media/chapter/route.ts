import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { grantChapterAudio } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const querySchema = z.object({ editionId: z.string().min(1).max(64), idx: z.coerce.number().int().min(0).max(9999) });

/** GET /api/media/chapter?editionId=&idx= : a signed URL for one audiobook chapter, for owners only. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await rateLimit(`media:${session.user.id}`, 60, "1 m")).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const grant = await grantChapterAudio({ userId: session.user.id, editionId: parsed.data.editionId, chapterIdx: parsed.data.idx });
  if (!grant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(grant, { headers: { "Cache-Control": "no-store" } });
}
