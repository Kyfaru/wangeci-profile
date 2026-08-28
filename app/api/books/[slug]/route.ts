import { NextResponse } from "next/server";
import { findBookBySlug } from "@/lib/mock-books";

/**
 * GET /api/books/[slug]
 *
 * Judgment call: returns the full Book fixture (including chapter bodies)
 * with no access gating. The real backend will likely want to gate full
 * chapter content behind purchase/entitlement — that's out of scope for a
 * local mock and left for whichever workstream wires up real access
 * control. `GET /api/books/[slug]/preview` is the separate, intentionally
 * lightweight marketing-preview endpoint.
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

  return NextResponse.json({ book });
}
