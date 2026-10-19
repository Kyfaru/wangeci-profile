import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { clientIp, limit } from "@/lib/rate-limit";
import { getSignedUploadUrl } from "@/lib/r2";
import { checkAdmin } from "@/lib/server/session";
import { api, AppError } from "@/lib/trace";

export const dynamic = "force-dynamic";

const UPLOAD_URL_TTL_SECONDS = 900; // 15 minutes to start the upload
const MAX_AUDIO_BYTES = 400 * 1024 * 1024; // 400 MB: about 4 hours of 192 kbps narration
const UPLOADS_PER_HOUR = 60; // an owner uploading a whole book, with retries

/** Only these pairs are accepted: the extension and the declared type must agree, and the type is signed into the URL. */
const AUDIO_TYPES: Record<string, string[]> = { ".mp3": ["audio/mpeg"], ".m4a": ["audio/mp4", "audio/x-m4a"] };

const bodySchema = z.object({
  editionId: z.string().min(1).max(64),
  chapterId: z.string().min(1).max(64),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

/**
 * POST /api/admin/chapter-audio : a short-lived presigned PUT so the owner's browser can upload a chapter's
 * audio straight to the protected bucket. Returns {url, key, expiresIn}; the key is later passed to
 * attachChapterAudioAction, which re-checks the real object before it is used.
 */
async function handlePOST(request: NextRequest) {
  const check = await checkAdmin("content.manage");
  if (!check.ok) throw new AppError("ADMIN_FORBIDDEN", "You are not allowed to do that.", 403);
  await limit(`admin:chapter-audio:${check.user.id}:${clientIp(request.headers)}`, UPLOADS_PER_HOUR, "1 h");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("ADMIN_AUDIO_INVALID", "The upload request is incomplete.", 400);
  const { editionId, chapterId, filename, contentType, sizeBytes } = parsed.data;

  const ext = /\.[A-Za-z0-9]+$/.exec(filename)?.[0].toLowerCase() ?? "";
  if (!AUDIO_TYPES[ext]?.includes(contentType)) throw new AppError("ADMIN_AUDIO_TYPE", "Only MP3 or M4A audio files can be uploaded.", 400);
  if (sizeBytes > MAX_AUDIO_BYTES) throw new AppError("ADMIN_AUDIO_TOO_LARGE", "That file is larger than 400 MB. Split the chapter or lower the bitrate.", 400);

  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, editionId, edition: { format: "AUDIOBOOK" } }, select: { id: true } });
  if (!chapter) throw new AppError("ADMIN_CHAPTER_NOT_FOUND", "Chapter not found in that audiobook.", 404);

  // The random part means reordering chapters or re-uploading never reuses (or invalidates) an existing key.
  const key = `editions/${editionId}/audio/${chapterId}-${randomBytes(6).toString("hex")}${ext}`;
  const url = await getSignedUploadUrl(env.R2_BUCKET_PROTECTED, key, contentType, UPLOAD_URL_TTL_SECONDS);
  return NextResponse.json({ url, key, expiresIn: UPLOAD_URL_TTL_SECONDS }, { headers: { "Cache-Control": "no-store" } });
}

export const POST = api("admin.chapter-audio.post", handlePOST);
