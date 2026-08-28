import { NextResponse } from "next/server";
import { findBookBySlug } from "@/lib/mock-books";

/**
 * GET /api/books/[slug]/preview
 *
 * Lightweight marketing-preview payload: book summary + the single chapter
 * flagged `isFreePreview` on the first ebook edition (falls back to the
 * first chapter of the first edition if none is flagged). Distinct from the
 * full book-detail endpoint so a landing/marketing page never needs to load
 * the whole book to render a "read a free chapter" teaser.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const book = findBookBySlug(slug);

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const ebookEdition =
    book.editions.find((e) => e.format === "ebook") ?? book.editions[0];
  const previewChapter =
    ebookEdition?.chapters.find((c) => c.isFreePreview) ??
    ebookEdition?.chapters[0] ??
    null;

  return NextResponse.json({
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    cover: book.cover,
    description: book.description,
    price: book.price,
    currency: book.currency,
    rating: book.rating,
    reviewCount: book.reviewCount,
    previewChapter,
    editions: book.editions.map((e) => ({
      id: e.id,
      format: e.format,
      label: e.label,
      chapterCount: e.chapters.length,
    })),
  });
}
