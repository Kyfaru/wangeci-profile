import { NextRequest, NextResponse } from "next/server";
import { findEditionById } from "@/lib/mock-books";

/**
 * GET /api/reader/chapter?editionId=&idx=
 *
 * Returns one chapter (ebook: title/content; audiobook: title/audioUrl/
 * timingUrl/duration) plus enough edition/navigation context for a reader
 * or player UI to move forward/back without a second request.
 *
 * Judgment call: no entitlement gating here (same rationale as the book
 * detail endpoint) — a real implementation would likely 403 on chapters
 * past what the requester purchased/previewed.
 */
export async function GET(request: NextRequest) {
  const editionId = request.nextUrl.searchParams.get("editionId");
  const idxParam = request.nextUrl.searchParams.get("idx");

  if (!editionId || idxParam === null) {
    return NextResponse.json(
      { error: "editionId and idx are required query parameters" },
      { status: 400 }
    );
  }

  const idx = Number(idxParam);
  if (!Number.isInteger(idx) || idx < 0) {
    return NextResponse.json(
      { error: "idx must be a non-negative integer" },
      { status: 400 }
    );
  }

  const found = findEditionById(editionId);
  if (!found) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const { book, edition } = found;
  const chapter = edition.chapters.find((c) => c.idx === idx);

  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  const totalChapters = edition.chapters.length;

  return NextResponse.json({
    bookSlug: book.slug,
    bookTitle: book.title,
    editionId: edition.id,
    format: edition.format,
    narrator: edition.narrator,
    chapter,
    prevIdx: idx > 0 ? idx - 1 : null,
    nextIdx: idx < totalChapters - 1 ? idx + 1 : null,
    totalChapters,
  });
}
