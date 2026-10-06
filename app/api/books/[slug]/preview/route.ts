import { NextResponse } from "next/server";
import { findBookBySlug } from "@/lib/mock-books";

/** GET /api/books/[slug]/preview: only chapters flagged isFreePreview can ever leave here. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = findBookBySlug(slug);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const ebook = book.editions.find((e) => e.format === "ebook");
  const previewChapter = ebook?.chapters.find((c) => c.isFreePreview) ?? null;

  return NextResponse.json({
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    cover: book.cover,
    description: book.description,
    price: book.price,
    currency: book.currency,
    previewChapter,
    editions: book.editions.map((e) => ({ id: e.id, format: e.format, label: e.label, chapterCount: e.chapters.length })),
  });
}
