import { NextRequest, NextResponse } from "next/server";
import { MOCK_BOOKS } from "@/lib/mock-books";
import { MOCK_BLOG_POSTS } from "@/lib/mock-blog";
import { MOCK_BUSINESSES } from "@/lib/mock-businesses";

type SearchResultType = "book" | "blog" | "business";

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
        url: `/books/${book.slug}`,
        image: book.cover,
      });
    }
  }

  for (const post of MOCK_BLOG_POSTS) {
    if (matches(post.title, needle) || matches(post.excerpt, needle)) {
      results.push({
        type: "blog",
        id: post.slug,
        title: post.title,
        snippet: post.excerpt,
        url: `/blog/${post.slug}`,
        image: post.coverImage,
      });
    }
  }

  for (const business of MOCK_BUSINESSES) {
    if (
      matches(business.name, needle) ||
      matches(business.description, needle)
    ) {
      results.push({
        type: "business",
        id: business.slug,
        title: business.name,
        snippet: business.description,
        url: `/businesses/${business.slug}`,
        image: business.logo,
      });
    }
  }

  return NextResponse.json({ query: q, results, total: results.length });
}
