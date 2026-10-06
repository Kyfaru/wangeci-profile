import { NextResponse } from "next/server";
import { z } from "zod";

import { grantChapterAudio } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ editionId: z.string().min(1).max(64), chapterIdx: z.number().int().min(0).max(9999) });

/**
 * POST /api/media/refresh : a NEW signed URL for the chapter that is playing. The player calls it at
 * about 80% of the old URL's life and swaps the source without remounting the audio element. The
 * entitlement is checked again every time, so a refund stops new links immediately.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (!(await rateLimit(`media:${session.user.id}`, 60, "1 m")).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const grant = await grantChapterAudio({ userId: session.user.id, editionId: parsed.data.editionId, chapterIdx: parsed.data.chapterIdx });
  if (!grant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(grant, { headers: { "Cache-Control": "no-store" } });
}
