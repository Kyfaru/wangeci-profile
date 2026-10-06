import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ListenClient } from "@/components/audio/ListenClient";
import { BreadcrumbBar } from "@/components/dashboard/BreadcrumbBar";
import { getBookBySlug } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";
import { parseLocator } from "@/lib/reading/locator";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboard/books/[slug]/listen">): Promise<Metadata> {
  const book = await getBookBySlug((await params).slug);
  return book ? { title: `${book.title}: Listen`, robots: { index: false } } : {};
}

/** `/dashboard/books/[slug]/listen`: owners of the audiobook only. The page never contains an audio link; the player asks for one. */
export default async function ListenPage({ params }: PageProps<"/dashboard/books/[slug]/listen">) {
  const user = await requireUser();
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  const audio = book?.editions.find((e) => e.format === "audiobook");
  if (!book || !audio) notFound();

  const entitled = await prisma.entitlement.findUnique({ where: { userId_editionId: { userId: user.id, editionId: audio.id } }, select: { id: true } });
  if (!entitled) notFound();

  const [chapters, saved] = await Promise.all([
    prisma.chapter.findMany({ where: { editionId: audio.id, assetId: { not: null } }, orderBy: { idx: "asc" }, select: { idx: true, title: true, durationSeconds: true } }),
    prisma.readingPosition.findUnique({ where: { userId_editionId: { userId: user.id, editionId: audio.id } }, select: { locator: true } }),
  ]);
  if (chapters.length === 0) notFound();

  const resume = saved ? parseLocator(saved.locator) : null;
  const startChapterIdx = resume && chapters.some((c) => c.idx === resume.chapterIdx) ? resume.chapterIdx : chapters[0].idx;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
      <BreadcrumbBar bookTitle={`${book.title} (audiobook)`} />
      <ListenClient
        editionId={audio.id}
        slug={slug}
        bookTitle={book.title}
        author={book.author}
        cover={book.cover}
        chapters={chapters}
        startChapterIdx={startChapterIdx}
        startSeconds={resume?.chapterIdx === startChapterIdx ? resume.offset : 0}
      />
    </div>
  );
}
