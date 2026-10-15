import { NextResponse } from "next/server";
import { getBookBySlug, getFreePreview } from "@/lib/catalogue";
import { api } from "@/lib/trace";

/** GET /api/books/[slug]/preview: the free chapter. getFreePreview filters on isFreePreview in the query itself. */
async function handleGET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ slug: book.slug, title: book.title, previewChapter: await getFreePreview(slug) });
}

export const GET = api("books.slug.preview.get", handleGET);
