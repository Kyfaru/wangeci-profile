import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { publicUrl } from "@/lib/r2";

/**
 * Read model for the public catalogue, built from Work, Edition, Asset and Chapter.
 * Only digital editions are sold (EPUB and AUDIOBOOK); PAPERBACK rows are ignored.
 * Page code never touches Prisma rows directly, so the database can change without the pages caring.
 */
export type CatalogueFormat = "ebook" | "audiobook";

export interface CatalogueEdition {
  id: string;
  format: CatalogueFormat;
  label: string;
  price: number;
  currency: string;
  narrator: string | null;
  durationSeconds: number | null;
  chapterCount: number;
}

export interface CatalogueBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  description: string | null;
  cover: string;
  editions: CatalogueEdition[];
}

const FALLBACK_COVER = "/images/from-pieces-to-power-front-cover.png";

const bookInclude = {
  editions: {
    where: { isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } },
    orderBy: { format: "asc" },
    include: { assets: { where: { kind: "COVER_IMAGE" }, take: 1 }, _count: { select: { chapters: true } } },
  },
} satisfies Prisma.WorkInclude;

type WorkRow = Prisma.WorkGetPayload<{ include: typeof bookInclude }>;

/** bucket "local" means a file under /public (used by the seed); anything else is the public R2 bucket. */
function coverFrom(assets: { bucket: string; key: string }[]): string | null {
  const cover = assets[0];
  if (!cover) return null;
  return cover.bucket === "local" ? cover.key : publicUrl(cover.key);
}

function toBook(work: WorkRow): CatalogueBook {
  const editions: CatalogueEdition[] = work.editions.map((e) => ({
    id: e.id,
    format: e.format === "EPUB" ? "ebook" : "audiobook",
    label: e.title ?? (e.format === "EPUB" ? "Ebook" : "Audiobook"),
    price: Number(e.price),
    currency: e.currency,
    narrator: e.narrator,
    durationSeconds: e.durationSeconds,
    chapterCount: e._count.chapters,
  }));
  const cover = work.editions.map((e) => coverFrom(e.assets)).find(Boolean) ?? FALLBACK_COVER;
  return { id: work.id, slug: work.slug, title: work.title, author: work.author, description: work.description, cover, editions };
}

/** Works that have at least one active digital edition. */
export async function listBooks(): Promise<CatalogueBook[]> {
  const works = await prisma.work.findMany({
    where: { editions: { some: { isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } } } },
    include: bookInclude,
    orderBy: { createdAt: "asc" },
  });
  return works.map(toBook);
}

export async function getBookBySlug(slug: string): Promise<CatalogueBook | null> {
  const work = await prisma.work.findUnique({ where: { slug }, include: bookInclude });
  if (!work || work.editions.length === 0) return null;
  return toBook(work);
}

export interface PreviewChapter {
  idx: number;
  title: string;
  paragraphs: string[];
}

/**
 * The free preview. The query itself filters on isFreePreview, so paid chapter text can never leave
 * through here no matter what the caller passes.
 */
export async function getFreePreview(slug: string): Promise<PreviewChapter | null> {
  const chapter = await prisma.chapter.findFirst({
    where: { isFreePreview: true, body: { not: null }, edition: { isActive: true, format: "EPUB", work: { slug } } },
    orderBy: { idx: "asc" },
    select: { idx: true, title: true, body: true },
  });
  if (!chapter?.body) return null;
  return { idx: chapter.idx, title: chapter.title, paragraphs: chapter.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) };
}

export const formatPrice = (price: number, currency: string) => `${currency} ${price.toLocaleString("en-KE")}`;
