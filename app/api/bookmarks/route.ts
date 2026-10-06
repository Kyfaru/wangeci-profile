import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  editionId: z.string().min(1).max(64),
  chapterIdx: z.number().int().min(0).max(9999),
  position: z.number().int().min(0).max(10_000_000).default(0),
  note: z.string().trim().max(300).optional(),
});

/** Does this person own this edition? Every bookmark call asks first. */
const owns = async (userId: string, editionId: string) =>
  Boolean(await prisma.entitlement.findUnique({ where: { userId_editionId: { userId, editionId } }, select: { id: true } }));

/** GET /api/bookmarks?editionId= : the signed-in person's own bookmarks. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const editionId = request.nextUrl.searchParams.get("editionId") ?? undefined;
  const items = await prisma.bookmark.findMany({
    where: { userId: session.user.id, ...(editionId ? { editionId } : {}) },
    orderBy: [{ chapterIdx: "asc" }, { position: "asc" }],
    select: { id: true, editionId: true, chapterIdx: true, position: true, note: true, createdAt: true },
  });
  return NextResponse.json({ items, total: items.length });
}

/** POST /api/bookmarks : add one (idempotent for the same spot). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { editionId, chapterIdx, position, note } = parsed.data;

  if (!(await rateLimit(`bookmark:${session.user.id}`, 30, "1 m")).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  if (!(await owns(session.user.id, editionId))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const chapter = await prisma.chapter.findUnique({ where: { editionId_idx: { editionId, idx: chapterIdx } }, select: { id: true } });
  if (!chapter) return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });

  const bookmark = await prisma.bookmark.upsert({
    where: { userId_editionId_chapterIdx_position: { userId: session.user.id, editionId, chapterIdx, position } },
    create: { userId: session.user.id, editionId, chapterIdx, position, note },
    update: {},
    select: { id: true, chapterIdx: true, position: true },
  });
  return NextResponse.json({ bookmark }, { status: 201 });
}

/** DELETE /api/bookmarks?id= : remove one of your own. */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { count } = await prisma.bookmark.deleteMany({ where: { id, userId: session.user.id } }); // userId in the filter: never someone else's
  return count > 0 ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
