import { NextResponse } from "next/server";
import { getBookBySlug } from "@/lib/catalogue";
import { api } from "@/lib/trace";

/**
 * GET /api/books/[slug]: public catalogue metadata only (no chapter text, ever).
 * Paid text is served only after a session and Entitlement check (Phase 4).
 */
async function handleGET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const book = await getBookBySlug((await params).slug);
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ book });
}

export const GET = api("books.slug.get", handleGET);
