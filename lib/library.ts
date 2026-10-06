import "server-only";

import { getBookBySlug } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";

export type LibraryStatus = "not-started" | "in-progress" | "completed";
export type LibraryFormat = "ebook" | "audiobook";

export interface LibraryItem {
  editionId: string;
  slug: string;
  title: string;
  author: string;
  cover: string;
  format: LibraryFormat;
  progressPercent: number;
  status: LibraryStatus;
  bookmarkCount: number;
  href: string;
}

/** 98 percent and above counts as finished (the last pages are often an epilogue or thanks). */
export const COMPLETED_AT = 98;

export const statusFor = (pct: number): LibraryStatus => (pct >= COMPLETED_AT ? "completed" : pct > 0 ? "in-progress" : "not-started");

/**
 * Everything a person owns: Entitlement joined with Edition, Work, cover and their own ReadingPosition
 * and bookmarks. Only active or already-owned editions appear (owning an edition that is later
 * retired still shows it: people keep what they bought).
 */
export async function getLibrary(userId: string): Promise<LibraryItem[]> {
  const rows = await prisma.entitlement.findMany({
    where: { userId, edition: { format: { in: ["EPUB", "AUDIOBOOK"] } } },
    orderBy: { grantedAt: "desc" },
    include: { edition: { include: { work: true } } },
  });
  if (rows.length === 0) return [];

  const editionIds = rows.map((r) => r.editionId);
  const [positions, marks] = await Promise.all([
    prisma.readingPosition.findMany({ where: { userId, editionId: { in: editionIds } }, select: { editionId: true, progressPct: true } }),
    prisma.bookmark.groupBy({ by: ["editionId"], where: { userId, editionId: { in: editionIds } }, _count: true }),
  ]);

  const items = await Promise.all(
    rows.map(async (r): Promise<LibraryItem> => {
      const format: LibraryFormat = r.edition.format === "EPUB" ? "ebook" : "audiobook";
      const pct = positions.find((p) => p.editionId === r.editionId)?.progressPct ?? 0;
      const slug = r.edition.work.slug;
      const book = await getBookBySlug(slug); // for the cover; null if the edition was retired
      return {
        editionId: r.editionId,
        slug,
        title: r.edition.title ?? r.edition.work.title,
        author: r.edition.work.author,
        cover: book?.cover ?? "/images/from-pieces-to-power-front-cover.png",
        format,
        progressPercent: pct,
        status: statusFor(pct),
        bookmarkCount: marks.find((m) => m.editionId === r.editionId)?._count ?? 0,
        href: `/dashboard/books/${slug}/${format === "ebook" ? "read" : "listen"}`,
      };
    }),
  );
  return items;
}
