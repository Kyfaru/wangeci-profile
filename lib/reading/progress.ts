import { prisma } from "@/lib/prisma";
import { audioProgressPercent, encodeLocator, progressPercent } from "@/lib/reading/locator";

export type SaveResult = "saved" | "forbidden" | "invalid";

/**
 * Saves where a person is in a book. The server checks they own it and works out the percentage
 * itself from the chapter lengths: the browser's own idea of "percent" is never trusted.
 */
export async function saveProgress(input: { userId: string; editionId: string; chapterIdx: number; offset: number }): Promise<SaveResult> {
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_editionId: { userId: input.userId, editionId: input.editionId } },
    select: { edition: { select: { format: true } } },
  });
  if (!entitlement) return "forbidden";

  const chapters = await prisma.chapter.findMany({ where: { editionId: input.editionId }, select: { idx: true, wordCount: true, durationSeconds: true } });
  if (!chapters.some((c) => c.idx === input.chapterIdx)) return "invalid";

  const isAudio = entitlement.edition.format === "AUDIOBOOK";
  const pct = isAudio ? audioProgressPercent(chapters, input.chapterIdx, input.offset) : progressPercent(chapters, input.chapterIdx, input.offset);
  const locator = encodeLocator(input.chapterIdx, input.offset);

  await prisma.readingPosition.upsert({
    where: { userId_editionId: { userId: input.userId, editionId: input.editionId } },
    create: { userId: input.userId, editionId: input.editionId, locator, progressPct: pct },
    update: { locator, progressPct: pct },
  });
  return "saved";
}
