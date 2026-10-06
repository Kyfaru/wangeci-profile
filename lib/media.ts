import "server-only";

import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/r2";

export interface AudioGrant {
  url: string;
  /** Seconds the URL stays valid. The player asks for a new one at about 80% of this. */
  expiresInSeconds: number;
  chapterIdx: number;
  title: string;
  durationSeconds: number | null;
  /** The chapter text for read-along, sent only together with the audio link (same purchase check). */
  text: string | null;
}

/** Chapter length plus a margin, never a day: a leaked link dies quickly. */
export const audioTtlSeconds = (durationSeconds: number | null) => Math.min(3 * 3600, Math.max(600, (durationSeconds ?? 0) + 300));

/**
 * Hands out a short-lived signed URL for one audiobook chapter, but only after checking, right now, that
 * this person owns this audiobook. Used for the first play and again for every refresh, so a refund
 * (which removes the entitlement) stops new links straight away.
 * Returns null for "no such thing for you": not owned, not audio, or no file yet.
 */
export async function grantChapterAudio(input: { userId: string; editionId: string; chapterIdx: number }): Promise<AudioGrant | null> {
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_editionId: { userId: input.userId, editionId: input.editionId } },
    select: { edition: { select: { format: true, isActive: true } } },
  });
  if (!entitlement || entitlement.edition.format !== "AUDIOBOOK") return null;

  const chapter = await prisma.chapter.findUnique({ where: { editionId_idx: { editionId: input.editionId, idx: input.chapterIdx } } });
  if (!chapter?.assetId) return null;
  const asset = await prisma.asset.findUnique({ where: { id: chapter.assetId } });
  if (!asset || asset.kind !== "AUDIO_FILE") return null;

  const expiresInSeconds = audioTtlSeconds(chapter.durationSeconds);
  // bucket "local" means a file in /public: allowed only outside production, for development and tests.
  const url = asset.bucket === "local" && process.env.NODE_ENV !== "production" ? asset.key : await getSignedDownloadUrl(asset.bucket, asset.key, expiresInSeconds);
  return { url, expiresInSeconds, chapterIdx: chapter.idx, title: chapter.title, durationSeconds: chapter.durationSeconds, text: chapter.body };
}
