import { NextResponse } from "next/server";
import { findBookBySlug } from "@/lib/mock-books";

/**
 * GET /api/books/[slug]: public catalogue metadata only.
 * Chapter text is never returned here (that was the paywall bypass); paid text
 * is served only after a session and Entitlement check (Phase 4).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = findBookBySlug(slug);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  return NextResponse.json({
    book: {
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      author: book.author,
      cover: book.cover,
      description: book.description,
      price: book.price,
      currency: book.currency,
      editions: book.editions.map((e) => ({ id: e.id, format: e.format, label: e.label, chapterCount: e.chapters.length })),
    },
  });
}
