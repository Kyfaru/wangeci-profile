import { NextRequest, NextResponse } from "next/server";
import { MOCK_BOOKS } from "@/lib/mock-books";

type SearchResultType = "book";

interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  snippet: string;
  url: string;
  image?: string;
}

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query);
}

/**
 * GET /api/search?q=
 *
 * Naive case-insensitive substring match across books, blog posts, and
 * businesses — plenty for local UI development. A real implementation is
 * Meilisearch per the System Connections Doc; this mock exists only so the
 * search UI has something to call while that's built.
 */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (!q) {
    return NextResponse.json({ query: q, results: [], total: 0 });
  }

  const needle = q.toLowerCase();
  const results: SearchResult[] = [];

  for (const book of MOCK_BOOKS) {
    if (matches(book.title, needle) || matches(book.description, needle)) {
      results.push({
        type: "book",
        id: book.slug,
        title: book.title,
        snippet: book.description,
        url: `/store/${book.slug}`,
        image: book.cover,
      });
    }
  }

  return NextResponse.json({ query: q, results, total: results.length });
}
