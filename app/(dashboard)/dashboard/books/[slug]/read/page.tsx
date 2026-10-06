import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbBar } from "@/components/dashboard/BreadcrumbBar";
import { ReaderActions } from "@/components/dashboard/ReaderActions";
import { ReaderPager } from "@/components/dashboard/ReaderPager";
import { ReaderProgressSync } from "@/components/dashboard/ReaderProgressSync";
import { ReaderRail } from "@/components/dashboard/ReaderRail";
import { getBookBySlug } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboard/books/[slug]/read">): Promise<Metadata> {
  const book = await getBookBySlug((await params).slug);
  return book ? { title: `${book.title}: Reader`, robots: { index: false } } : {};
}

/**
 * `/dashboard/books/[slug]/read`: Figma "The Book" frame. Phase 4 rebuilds the reading experience
 * (device-sized pages, saved position); this version already enforces the paywall from the database.
 */
export default async function ReaderPage({ params, searchParams }: PageProps<"/dashboard/books/[slug]/read">) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;

  const book = await getBookBySlug(slug);
  const ebook = book?.editions.find((e) => e.format === "ebook");
  if (!book || !ebook) notFound();

  // The paywall: no entitlement row for this user and edition means no chapter text.
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_editionId: { userId: user.id, editionId: ebook.id } },
    select: { id: true },
  });
  if (!entitlement) notFound();

  const chapters = await prisma.chapter.findMany({ where: { editionId: ebook.id }, orderBy: { idx: "asc" }, select: { idx: true, title: true, body: true } });
  if (chapters.length === 0) notFound();

  const requested = typeof sp.idx === "string" ? Number(sp.idx) : NaN;
  const chapter = chapters.find((c) => c.idx === requested) ?? chapters[0];
  const position = chapters.findIndex((c) => c.idx === chapter.idx);
  const paragraphs = (chapter.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbBar
        bookTitle={book.title}
        actions={<ReaderActions editionId={ebook.id} chapterIdx={chapter.idx} initiallyBookmarked={false} />}
      />
      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 px-6 py-6 md:px-16 md:py-8">
            <h1 className="font-display text-[34px] text-black">{chapter.title}</h1>
            <div className="mt-8 max-w-[680px] space-y-5 text-lg leading-relaxed text-black">
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          <ReaderPager
            baseHref={`/dashboard/books/${slug}/read`}
            editionId={ebook.id}
            chapterIdx={chapter.idx}
            prevIdx={position > 0 ? chapters[position - 1].idx : null}
            nextIdx={position < chapters.length - 1 ? chapters[position + 1].idx : null}
            totalChapters={chapters.length}
          />
        </div>
        <ReaderRail cover={book.cover} title={book.title} author={book.author} description={book.description ?? ""} />
      </div>
      <ReaderProgressSync editionId={ebook.id} chapterIdx={chapter.idx} />
    </div>
  );
}
