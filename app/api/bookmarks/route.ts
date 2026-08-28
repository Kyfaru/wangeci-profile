import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/mock-auth";
import { createBookmark, listBookmarks } from "@/lib/server/mock-bookmarks-store";
import { findEditionById } from "@/lib/mock-books";

/**
 * GET /api/bookmarks?editionId=
 * Requires a session; optionally scoped to one edition.
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const editionId = request.nextUrl.searchParams.get("editionId") ?? undefined;
  const items = listBookmarks(userId, editionId);

  return NextResponse.json({ items, total: items.length });
}

interface CreateBookmarkBody {
  editionId: string;
  chapterIdx: number;
  position: number;
  note?: string;
}

function isValidBody(value: unknown): value is CreateBookmarkBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.editionId === "string" &&
    typeof v.chapterIdx === "number" &&
    typeof v.position === "number"
  );
}

/**
 * POST /api/bookmarks
 * Body: { editionId, chapterIdx, position, note? }
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        error:
          "editionId (string), chapterIdx (number), and position (number) are required",
      },
      { status: 400 }
    );
  }

  const found = findEditionById(body.editionId);
  if (!found) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const bookmark = createBookmark({
    userId,
    editionId: body.editionId,
    bookSlug: found.book.slug,
    chapterIdx: body.chapterIdx,
    position: body.position,
    note: body.note,
  });

  return NextResponse.json({ bookmark }, { status: 201 });
}
