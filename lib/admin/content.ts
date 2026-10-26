import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { type Actor, AdminError, reasonOrThrow } from "@/lib/admin/actions";
import { prisma } from "@/lib/prisma";
import { countWords, normaliseBody, splitManuscript } from "@/lib/reading/text";
import { recordAudit } from "@/lib/server/audit";
import { logError } from "@/lib/trace";

/**
 * Book authoring writes. Every function here follows the rules of lib/admin/actions.ts: it takes the acting
 * admin, changes data and writes ONE audit row in the same transaction. Audit meta never holds chapter text,
 * only word counts and a sha256 of the body, so the audit log cannot leak unpublished writing.
 * Failures are AdminError (the server action shows the message to the owner).
 */
type Tx = Prisma.TransactionClient;

const MAX_BODY_CHARS = 500_000; // a very long chapter; stops a paste of a whole library into one row
const MAX_IMPORT_CHAPTERS = 200;
const MAX_AUDIO_SECONDS = 6 * 3600; // one chapter file is never longer than six hours
const MIN_KBPS = 64; // below this the "audio" is almost certainly the wrong file
const MAX_KBPS = 400; // above this the file is not a normal MP3/M4A narration
const AUDIO_CONTENT_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a"];

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

const slugSchema = z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "The address may only use lower-case letters, numbers and dashes.");
const titleSchema = z.string().trim().min(1, "Give the chapter a title.").max(200);

/** Locks the edition row so two admin writes to the same book run one after the other (index and guard checks stay true). */
async function lockEdition(tx: Tx, editionId: string) {
  await tx.$queryRaw`SELECT id FROM edition WHERE id = ${editionId} FOR UPDATE`;
  const edition = await tx.edition.findUnique({ where: { id: editionId }, select: { id: true, format: true, isActive: true } });
  if (!edition) throw new AdminError("Edition not found.");
  return edition;
}

/**
 * A reason is only demanded when readers could be affected: the edition is live or someone owns it.
 * A draft nobody owns is the owner's scratch pad, so the reason is optional there.
 */
async function reasonFor(tx: Tx, edition: { id: string; isActive: boolean }, reason: string | undefined): Promise<string | null> {
  const owners = await tx.entitlement.count({ where: { editionId: edition.id } });
  if (edition.isActive || owners > 0) return reasonOrThrow(reason ?? "");
  return reason?.trim() ? reason.trim().slice(0, 500) : null;
}

/** Saved reading positions and bookmarks point at chapter numbers, so renumbering would move readers. */
async function assertNoReaders(tx: Tx, editionId: string) {
  const [positions, bookmarks] = await Promise.all([tx.readingPosition.count({ where: { editionId } }), tx.bookmark.count({ where: { editionId } })]);
  if (positions + bookmarks > 0) throw new AdminError("Readers already have a place saved in this book, so chapters cannot be moved or removed. You can still edit the text.");
}

/** What stops this edition going live (blocking) and what is only worth a look (warnings). */
export async function getPublishIssues(editionId: string, db: Tx | typeof prisma = prisma): Promise<{ blocking: string[]; warnings: string[] }> {
  const edition = await db.edition.findUnique({
    where: { id: editionId },
    select: { format: true, price: true, chapters: { orderBy: { idx: "asc" }, select: { idx: true, title: true, body: true, assetId: true, durationSeconds: true, isFreePreview: true } } },
  });
  if (!edition) return { blocking: ["Edition not found."], warnings: [] };

  const blocking: string[] = [];
  const warnings: string[] = [];
  if (Number(edition.price) <= 0) blocking.push("The price must be more than zero.");
  if (edition.chapters.length === 0) blocking.push("Add at least one chapter.");
  edition.chapters.forEach((c, i) => {
    const name = `Chapter ${i + 1} (${c.title})`;
    if (c.idx !== i) blocking.push(`${name} is out of order. Chapter numbers must run 1, 2, 3 without gaps.`);
    if (edition.format === "EPUB" && !c.body?.trim()) blocking.push(`${name} has no text.`);
    if (edition.format === "AUDIOBOOK" && (!c.assetId || !c.durationSeconds)) blocking.push(`${name} has no audio.`);
  });
  if (edition.chapters.length > 0 && !edition.chapters.some((c) => c.isFreePreview)) warnings.push("No chapter is marked as a free preview, so visitors cannot sample the book.");
  return { blocking, warnings };
}

/**
 * Creates a book as a draft. If the address (slug) already exists, a new draft edition is added to that
 * work and the work's title/author are left alone. Nothing is sold until setEditionActive publishes it.
 */
export async function createBook(input: { actor: Actor; title: string; slug: string; author: string; description?: string; format: string; price: number; currency: string; narrator?: string }): Promise<{ workId: string; editionId: string }> {
  const data = z
    .object({
      title: z.string().trim().min(1, "Enter the book title.").max(200),
      slug: slugSchema,
      author: z.string().trim().min(1, "Enter the author.").max(120),
      description: z.string().trim().max(2000).optional(),
      format: z.enum(["EPUB", "AUDIOBOOK"], { message: "Choose ebook or audiobook." }),
      price: z.number({ message: "Enter a price." }).gt(0, "The price must be more than zero.").max(1_000_000),
      currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency such as KES."),
      narrator: z.string().trim().max(120).optional(),
    })
    .parse(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.work.findUnique({ where: { slug: data.slug }, select: { id: true } });
    const work = existing ?? (await tx.work.create({ data: { slug: data.slug, title: data.title, author: data.author, description: data.description || null } }));
    const edition = await tx.edition.create({
      data: { workId: work.id, format: data.format, price: data.price.toFixed(2), currency: data.currency, narrator: data.format === "AUDIOBOOK" ? data.narrator || null : null, isActive: false },
    });
    await recordAudit({ adminId: input.actor.id, action: "book.created", targetType: "edition", targetId: edition.id, meta: { slug: data.slug, format: data.format, price: data.price, currency: data.currency, workCreated: !existing }, ip: input.actor.ip }, tx);
    return { workId: work.id, editionId: edition.id };
  });
}

/**
 * Saves one chapter. With a chapterId it edits that chapter; without one it appends a new chapter at the end
 * (the next number is worked out inside the transaction, so two quick saves cannot collide).
 */
export async function saveChapter(input: { actor: Actor; editionId: string; chapterId?: string; title: string; body: string; isFreePreview: boolean; reason?: string }): Promise<{ chapterId: string; idx: number }> {
  const title = titleSchema.parse(input.title);
  const body = normaliseBody(z.string().max(MAX_BODY_CHARS, "This chapter is too long. Split it into two chapters.").parse(input.body));
  const wordsAfter = countWords(body);

  return prisma.$transaction(async (tx) => {
    const edition = await lockEdition(tx, input.editionId);
    const reason = await reasonFor(tx, edition, input.reason);
    const fields = { title, body, wordCount: wordsAfter, isFreePreview: input.isFreePreview };

    let wordsBefore = 0;
    let bodyBefore = "";
    let chapter;
    if (input.chapterId) {
      const current = await tx.chapter.findFirst({ where: { id: input.chapterId, editionId: edition.id } });
      if (!current) throw new AdminError("Chapter not found.");
      wordsBefore = current.wordCount;
      bodyBefore = current.body ?? "";
      chapter = await tx.chapter.update({ where: { id: current.id }, data: fields });
    } else {
      const last = await tx.chapter.aggregate({ where: { editionId: edition.id }, _max: { idx: true } });
      chapter = await tx.chapter.create({ data: { ...fields, editionId: edition.id, idx: (last._max.idx ?? -1) + 1 } });
    }
    await recordAudit(
      { adminId: input.actor.id, action: input.chapterId ? "chapter.saved" : "chapter.added", targetType: "chapter", targetId: chapter.id, meta: { editionId: edition.id, idx: chapter.idx, title, isFreePreview: input.isFreePreview, wordsBefore, wordsAfter, sha256Before: sha256(bodyBefore), sha256After: sha256(body), reason }, ip: input.actor.ip },
      tx,
    );
    return { chapterId: chapter.id, idx: chapter.idx };
  });
}

/** Moves a chapter one place up or down by swapping numbers with its neighbour. */
export async function moveChapter(input: { actor: Actor; chapterId: string; dir: "up" | "down"; reason?: string }): Promise<{ ok: true }> {
  const dir = z.enum(["up", "down"]).parse(input.dir);
  const found = await prisma.chapter.findUnique({ where: { id: input.chapterId }, select: { editionId: true } });
  if (!found) throw new AdminError("Chapter not found.");

  await prisma.$transaction(async (tx) => {
    const edition = await lockEdition(tx, found.editionId);
    const chapter = await tx.chapter.findUnique({ where: { id: input.chapterId } }); // re-read: it may have moved while we waited for the lock
    if (!chapter) throw new AdminError("Chapter not found.");
    await assertNoReaders(tx, edition.id); // check this first: it is the real reason a move can fail
    const reason = await reasonFor(tx, edition, input.reason ?? "Reordered chapters"); // the up/down buttons have no reason box

    const neighbour = await tx.chapter.findUnique({ where: { editionId_idx: { editionId: edition.id, idx: chapter.idx + (dir === "up" ? -1 : 1) } } });
    if (!neighbour) throw new AdminError(dir === "up" ? "This is already the first chapter." : "This is already the last chapter.");

    // (editionId, idx) is unique, so park one chapter on -1 while the two numbers swap.
    await tx.chapter.update({ where: { id: chapter.id }, data: { idx: -1 } });
    await tx.chapter.update({ where: { id: neighbour.id }, data: { idx: chapter.idx } });
    await tx.chapter.update({ where: { id: chapter.id }, data: { idx: neighbour.idx } });
    await recordAudit({ adminId: input.actor.id, action: "chapter.moved", targetType: "chapter", targetId: chapter.id, meta: { editionId: edition.id, from: chapter.idx, to: neighbour.idx, reason }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

/** Deletes the LAST chapter only (deleting from the middle would renumber the rest). Its audio file is removed too. */
export async function deleteChapter(input: { actor: Actor; chapterId: string; reason?: string }): Promise<{ ok: true }> {
  const found = await prisma.chapter.findUnique({ where: { id: input.chapterId }, select: { editionId: true } });
  if (!found) throw new AdminError("Chapter not found.");

  const removedAudio = await prisma.$transaction(async (tx) => {
    const edition = await lockEdition(tx, found.editionId);
    const chapter = await tx.chapter.findUnique({ where: { id: input.chapterId } });
    if (!chapter) throw new AdminError("Chapter not found.");
    await assertNoReaders(tx, edition.id);
    const reason = await reasonFor(tx, edition, input.reason);

    const last = await tx.chapter.aggregate({ where: { editionId: edition.id }, _max: { idx: true } });
    if (chapter.idx !== last._max.idx) throw new AdminError("Only the last chapter can be deleted. Move this chapter to the end first.");

    await tx.chapter.delete({ where: { id: chapter.id } });
    const asset = chapter.assetId ? await tx.asset.findUnique({ where: { id: chapter.assetId } }) : null;
    if (asset) await tx.asset.delete({ where: { id: asset.id } });
    await syncEditionDuration(tx, edition);
    await recordAudit({ adminId: input.actor.id, action: "chapter.deleted", targetType: "chapter", targetId: chapter.id, meta: { editionId: edition.id, idx: chapter.idx, title: chapter.title, wordsBefore: chapter.wordCount, sha256Before: sha256(chapter.body ?? ""), reason }, ip: input.actor.ip }, tx);
    return asset;
  });
  if (removedAudio) await removeObjectQuietly(removedAudio.bucket, removedAudio.key);
  return { ok: true };
}

/** An audiobook's total length is always the sum of its chapters. */
async function syncEditionDuration(tx: Tx, edition: { id: string; format: string }) {
  if (edition.format !== "AUDIOBOOK") return;
  const total = await tx.chapter.aggregate({ where: { editionId: edition.id }, _sum: { durationSeconds: true } });
  await tx.edition.update({ where: { id: edition.id }, data: { durationSeconds: total._sum.durationSeconds ?? null } });
}

/** Loaded on demand: lib/r2 and lib/env need the storage keys, which publish checks and text edits (and their tests) do not. */
const loadStorage = () => import("@/lib/r2");

/** Runs after the database commit: a leftover file costs pennies, a failed delete must not undo the change. */
async function removeObjectQuietly(bucket: string, key: string) {
  try {
    await (await loadStorage()).deleteObject(bucket, key);
  } catch (error) {
    logError("admin.content.delete-object", error, { bucket, key });
  }
}

/**
 * Attaches an uploaded audio file to an audiobook chapter. The browser uploaded straight to R2; here the
 * server checks the object really exists in the protected bucket and that its size fits the stated length
 * (a 64-400 kbps narration), so a wrong or truncated file is caught before listeners meet it.
 */
export async function attachChapterAudio(input: { actor: Actor; chapterId: string; key: string; durationSeconds: number; reason?: string }): Promise<{ ok: true }> {
  const seconds = z.number({ message: "Enter the audio length." }).int().gt(0, "The audio length must be more than zero.").max(MAX_AUDIO_SECONDS, "A chapter can be at most 6 hours long.").parse(input.durationSeconds);
  const found = await prisma.chapter.findUnique({ where: { id: input.chapterId }, select: { editionId: true } });
  if (!found) throw new AdminError("Chapter not found.");

  const bucket = (await import("@/lib/env")).env.R2_BUCKET_PROTECTED;
  const prefix = `editions/${found.editionId}/audio/`;
  if (!input.key.startsWith(prefix) || !/^[\w.-]+$/.test(input.key.slice(prefix.length))) throw new AdminError("That file does not belong to this book.");
  const head = await (await loadStorage()).headObject(bucket, input.key);
  if (!head) throw new AdminError("The uploaded file was not found. Upload it again.");
  if (head.contentType && !AUDIO_CONTENT_TYPES.includes(head.contentType)) throw new AdminError("Only MP3 or M4A audio files are accepted.");
  const kbps = (head.sizeBytes * 8) / seconds / 1000;
  if (kbps < MIN_KBPS || kbps > MAX_KBPS) throw new AdminError(`The file size does not match a ${seconds}-second narration (${Math.round(kbps)} kbps; expected ${MIN_KBPS} to ${MAX_KBPS}). Check you chose the right file and length.`);

  const replaced = await prisma.$transaction(async (tx) => {
    const edition = await lockEdition(tx, found.editionId);
    if (edition.format !== "AUDIOBOOK") throw new AdminError("Audio can only be added to an audiobook edition.");
    const chapter = await tx.chapter.findUnique({ where: { id: input.chapterId } });
    if (!chapter) throw new AdminError("Chapter not found.");
    const reason = await reasonFor(tx, edition, input.reason);
    if (await tx.asset.findFirst({ where: { bucket, key: input.key }, select: { id: true } })) throw new AdminError("That file is already attached.");

    const previous = chapter.assetId ? await tx.asset.findUnique({ where: { id: chapter.assetId } }) : null;
    const asset = await tx.asset.create({
      data: { editionId: edition.id, kind: "AUDIO_FILE", bucket, key: input.key, mimeType: head.contentType ?? (input.key.endsWith(".mp3") ? "audio/mpeg" : "audio/mp4"), sizeBytes: head.sizeBytes },
    });
    await tx.chapter.update({ where: { id: chapter.id }, data: { assetId: asset.id, durationSeconds: seconds } });
    if (previous) await tx.asset.delete({ where: { id: previous.id } });
    await syncEditionDuration(tx, edition);
    await recordAudit({ adminId: input.actor.id, action: "chapter.audio_attached", targetType: "chapter", targetId: chapter.id, meta: { editionId: edition.id, idx: chapter.idx, key: input.key, sizeBytes: head.sizeBytes, durationSeconds: seconds, replaced: Boolean(previous), reason }, ip: input.actor.ip }, tx);
    return previous;
  });
  if (replaced) await removeObjectQuietly(replaced.bucket, replaced.key);
  return { ok: true };
}

/**
 * Adds many chapters at once from a pasted manuscript (each chapter starts with a "## Title" line).
 * Chapters are appended after the existing ones. Refused on a live edition that has owners: a bulk change
 * to something people already paid for must be done one chapter at a time, with a reason each.
 */
export async function importManuscript(input: { actor: Actor; editionId: string; manuscript: string; reason?: string }): Promise<{ added: number }> {
  const chapters = splitManuscript(z.string().max(MAX_BODY_CHARS * 20, "This manuscript is too large to import in one go.").parse(input.manuscript));
  if (chapters.length === 0) throw new AdminError('No chapters found. Start each chapter with a line like "## Chapter title".');
  if (chapters.length > MAX_IMPORT_CHAPTERS) throw new AdminError(`A manuscript can import at most ${MAX_IMPORT_CHAPTERS} chapters at a time.`);
  chapters.forEach((c, i) => {
    if (!c.title) throw new AdminError(`Chapter ${i + 1} has no title after "##".`);
    if (c.title.length > 200) throw new AdminError(`The title of chapter ${i + 1} is too long.`);
    if (c.body.length > MAX_BODY_CHARS) throw new AdminError(`Chapter ${i + 1} is too long. Split it into two chapters.`);
  });

  await prisma.$transaction(async (tx) => {
    const edition = await lockEdition(tx, input.editionId);
    if (edition.format !== "EPUB") throw new AdminError("Manuscript import is for ebook editions.");
    const owners = await tx.entitlement.count({ where: { editionId: edition.id } });
    if (edition.isActive && owners > 0) throw new AdminError("This book is live and already owned by readers. Edit its chapters one at a time instead.");
    const reason = await reasonFor(tx, edition, input.reason);

    const last = await tx.chapter.aggregate({ where: { editionId: edition.id }, _max: { idx: true } });
    const start = (last._max.idx ?? -1) + 1;
    await tx.chapter.createMany({ data: chapters.map((c, i) => ({ editionId: edition.id, idx: start + i, title: c.title, body: c.body, wordCount: countWords(c.body) })) });
    await recordAudit({ adminId: input.actor.id, action: "manuscript.imported", targetType: "edition", targetId: edition.id, meta: { added: chapters.length, firstIdx: start, words: chapters.reduce((n, c) => n + countWords(c.body), 0), sha256: sha256(input.manuscript), reason }, ip: input.actor.ip }, tx);
  });
  return { added: chapters.length };
}
