import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuyBookButton } from "@/components/store/BuyBookButton";
import { ClockIcon } from "@/components/store/icons";
import { TableOfContentsCard } from "@/components/store/TableOfContentsCard";
import { Card, RatingBadge, StatChip } from "@/components/ui";
import {
  findBookBySlug,
  MOCK_BOOKS,
  type BookEdition,
  type ListeningChapter,
  type ReadingChapter,
} from "@/lib/mock-books";

export function generateStaticParams() {
  return MOCK_BOOKS.map((book) => ({ slug: book.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/store/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const book = findBookBySlug(slug);
  if (!book) return {};

  return {
    title: `${book.title} — Felister Wangechi Kariuki`,
    description: book.description,
  };
}

function isEbookEdition(
  edition: BookEdition,
): edition is BookEdition & { chapters: ReadingChapter[] } {
  return edition.format === "ebook";
}

function isAudiobookEdition(
  edition: BookEdition,
): edition is BookEdition & { chapters: ListeningChapter[] } {
  return edition.format === "audiobook";
}

/** Formats a minute count as e.g. "45 min", "1 hr", "1.4 hrs". */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))} min`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${label} hr${hours === 1 ? "" : "s"}`;
}

/**
 * `/store/[slug]` — Book Preview, matching the Figma "Book Preview" frame.
 * Server component: reads the fixture directly (mirrors how a real
 * Prisma-backed page would fetch server-side) rather than round-tripping
 * through the mock `GET /api/books/[slug]` route from the server.
 */
export default async function BookPreviewPage({
  params,
}: PageProps<"/store/[slug]">) {
  const { slug } = await params;
  const book = findBookBySlug(slug);

  if (!book) notFound();

  const ebookEdition = book.editions.find(isEbookEdition);
  const audioEdition = book.editions.find(isAudiobookEdition);

  const readMinutes = ebookEdition
    ? ebookEdition.chapters.reduce((sum, c) => sum + c.wordCount, 0) / 200
    : undefined;
  const audioMinutes = audioEdition
    ? audioEdition.chapters.reduce((sum, c) => sum + c.durationSeconds, 0) /
      60
    : undefined;

  const durationParts: string[] = [];
  if (readMinutes) durationParts.push(`${formatDuration(readMinutes)} read`);
  if (audioMinutes) durationParts.push(`${formatDuration(audioMinutes)} audio`);
  const durationLabel = durationParts.join(" · ") || "Free preview available";

  const tocChapters = ebookEdition?.chapters ?? audioEdition?.chapters ?? [];

  const excerptChapter = ebookEdition
    ? (ebookEdition.chapters.find((c) => c.isFreePreview) ??
      ebookEdition.chapters[0])
    : undefined;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="mx-auto w-full max-w-[1440px] px-6 pt-12 pb-16 lg:px-12 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[420px_1fr] lg:items-center">
          {/* Cover placeholder — no real cover asset exists yet; see
              `book.cover` in lib/mock-books.ts for the eventual asset path. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              className="absolute -top-10 -left-10 size-44 rounded-full bg-gold-bright/25 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="absolute -right-8 -bottom-10 size-36 rounded-full bg-gold/20 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative aspect-3/4 w-full overflow-hidden rounded-card border border-gold/30 bg-linear-to-br from-navy via-navy to-navy/80 shadow-2xl">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <span className="text-xs font-semibold tracking-[0.2em] text-gold-bright uppercase">
                  {book.author}
                </span>
                <div className="h-px w-10 bg-gold/40" />
                <span className="font-display text-2xl leading-snug text-cream">
                  {book.title}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col gap-6">
            <span className="text-sm font-semibold tracking-[0.15em] text-gold uppercase">
              {book.author}
            </span>
            <h1 className="font-display text-4xl leading-tight text-navy sm:text-5xl">
              {book.title}
            </h1>
            {book.subtitle && (
              <p className="max-w-xl text-lg text-gray">{book.subtitle}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <StatChip
                icon={<ClockIcon />}
                count={durationLabel}
                variant="gold"
              />
              <RatingBadge rating={book.rating} count={book.reviewCount} />
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <BuyBookButton slug={book.slug} editionId={ebookEdition?.id} />
              <span className="font-display text-2xl text-navy">
                {book.currency} {book.price.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Table of Contents + Excerpt */}
      <section className="mx-auto w-full max-w-[1440px] px-6 pb-20 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <TableOfContentsCard chapters={tocChapters} />

          <div className="flex flex-col gap-8">
            <blockquote className="rounded-card bg-navy px-8 py-10 text-center">
              <p className="font-display text-2xl leading-snug text-cream sm:text-3xl">
                &ldquo;When you believe a lie, you begin to live in bondage;
                the truth is what sets you free&hellip;&rdquo;
              </p>
              <footer className="mt-4 text-sm font-semibold tracking-[0.15em] text-gold-bright uppercase">
                {book.author}
              </footer>
            </blockquote>

            {excerptChapter && (
              <Card padding="lg">
                <span className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">
                  Free Preview
                </span>
                <h2 className="mt-3 font-display text-2xl text-navy">
                  {excerptChapter.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed whitespace-pre-line text-navy/80">
                  {excerptChapter.content}
                </p>
              </Card>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
