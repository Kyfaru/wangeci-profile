import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Database tests run only when TEST_DATABASE_URL points at a throwaway local database.
const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

const mocks = vi.hoisted(() => ({
  checkAdmin: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(async () => {}),
  getSignedUploadUrl: vi.fn(async (_b: string, key: string) => `https://r2.test/${key}?sig=1`),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { R2_BUCKET_PROTECTED: "prot" } }));
vi.mock("@/lib/r2", () => ({
  publicUrl: (key: string) => `https://cdn.test/${key}`,
  headObject: mocks.headObject,
  deleteObject: mocks.deleteObject,
  getSignedUploadUrl: mocks.getSignedUploadUrl,
}));
vi.mock("@/lib/server/session", () => ({ checkAdmin: mocks.checkAdmin }));
vi.mock("@/lib/rate-limit", () => ({ limit: async () => {}, clientIp: () => "127.0.0.1" }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { POST } from "@/app/api/admin/chapter-audio/route";
import { buildTiming } from "@/lib/audio/word-timing";
import { getOwnedBook } from "@/lib/catalogue";
import { parseLocator, resolveStart } from "@/lib/reading/locator";
import { countWords, normaliseBody, splitManuscript } from "@/lib/reading/text";

import { AdminError, setEditionActive } from "./actions";
import { attachChapterAudio, createBook, deleteChapter, getPublishIssues, importManuscript, moveChapter, saveChapter } from "./content";

describe("chapter text", () => {
  it("counts words exactly like the reader tokenises them", () => {
    for (const raw of [" one two \r\n\r\n three ", "a\r\n\r\n\r\n\r\nb", "﻿Hello   world\n\nBye", "", "   "]) {
      expect(countWords(raw)).toBe(buildTiming(normaliseBody(raw)).words.length);
    }
    expect(countWords(" one two \r\n\r\n three ")).toBe(3);
  });

  it("normalises line endings, BOM and blank-line runs", () => {
    expect(normaliseBody("﻿  a\r\n\r\n\r\n\r\nb \r\n")).toBe("a\n\nb");
  });

  it("splits a manuscript at '## ' headings and ignores text before the first one", () => {
    const parts = splitManuscript("Preface\r\n\r\n## One\r\nHello there\r\n\r\n\r\n\r\nSecond para\r\n## Two\r\nBye");
    expect(parts).toEqual([
      { title: "One", body: "Hello there\n\nSecond para" },
      { title: "Two", body: "Bye" },
    ]);
    expect(splitManuscript("no headings at all")).toEqual([]);
  });
});

describe("resolveStart", () => {
  const chapters = [
    { idx: 0, wordCount: 100 },
    { idx: 1, wordCount: 200 },
    { idx: 2, wordCount: 300 },
  ];
  it("opens at the top without any hint", () => expect(resolveStart({}, null, chapters)).toEqual({ position: 0, startWord: 0 }));
  it("resumes at the saved chapter and word", () => expect(resolveStart({}, { chapterIdx: 1, offset: 57 }, chapters)).toEqual({ position: 1, startWord: 57 }));
  it("an explicit link wins over the saved position", () => expect(resolveStart({ idx: "2", w: "10" }, { chapterIdx: 1, offset: 57 }, chapters)).toEqual({ position: 2, startWord: 10 }));
  it("w=end opens on the last word", () => expect(resolveStart({ idx: "1", w: "end" }, null, chapters)).toEqual({ position: 1, startWord: 199 }));
  it("a saved chapter that no longer exists starts at chapter 0, word 0 (not the old word offset)", () => expect(resolveStart({}, { chapterIdx: 9, offset: 500 }, chapters)).toEqual({ position: 0, startWord: 0 }));
  it("an explicit chapter that does not exist, or junk, also starts at the top", () => {
    expect(resolveStart({ idx: "9", w: "50" }, null, chapters)).toEqual({ position: 0, startWord: 0 });
    expect(resolveStart({ idx: "abc", w: "50" }, null, chapters)).toEqual({ position: 0, startWord: 0 });
    expect(resolveStart({ idx: "1", w: "-5" }, null, chapters)).toEqual({ position: 1, startWord: 0 });
  });
  it("parseLocator output plugs straight in", () => expect(resolveStart({}, parseLocator("2:40"), chapters)).toEqual({ position: 2, startWord: 40 }));
});

describe("POST /api/admin/chapter-audio", () => {
  const call = (body: unknown) => POST(new NextRequest("http://localhost/api/admin/chapter-audio", { method: "POST", body: JSON.stringify(body) }), undefined);
  const valid = { editionId: "e1", chapterId: "c1", filename: "ch1.mp3", contentType: "audio/mpeg", sizeBytes: 5_000_000 };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkAdmin.mockResolvedValue({ ok: true, user: { id: "admin1" } });
  });

  it("403 for anyone who is not an admin with content.manage", async () => {
    mocks.checkAdmin.mockResolvedValue({ ok: false, reason: "forbidden" });
    const res = await call(valid);
    expect(res.status).toBe(403);
    expect(mocks.getSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects a bad extension, a type that disagrees with the extension, and an oversize file", async () => {
    for (const bad of [{ filename: "ch1.wav", contentType: "audio/wav" }, { filename: "ch1.exe", contentType: "audio/mpeg" }, { filename: "ch1.mp3", contentType: "audio/mp4" }, { sizeBytes: 400 * 1024 * 1024 + 1 }]) {
      const res = await call({ ...valid, ...bad });
      expect(res.status).toBe(400);
    }
    expect(mocks.getSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    expect((await call({ editionId: "e1" })).status).toBe(400);
  });
});

describe.skipIf(!url)("book authoring (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const stamp = Date.now();
  let n = 0;
  const made = { users: [] as string[], works: [] as string[] };
  const REASON = "Fixing a typo reported by a reader";
  const SECRET = "ZEBRA-CHAPTER-TEXT-THAT-MUST-NOT-LEAK";

  async function user(role = "reader") {
    n += 1;
    const u = await db.user.create({ data: { name: `U${n}`, email: `ct-${stamp}-${n}@example.com`, emailVerified: true, role } });
    made.users.push(u.id);
    return u;
  }
  async function draft(format: "EPUB" | "AUDIOBOOK" = "EPUB") {
    n += 1;
    const work = await db.work.create({ data: { slug: `ct-w-${stamp}-${n}`, title: "W", author: "A" } });
    made.works.push(work.id);
    const edition = await db.edition.create({ data: { workId: work.id, format, price: "500.00", isActive: false } });
    return { work, edition };
  }
  const audit = (targetId: string) => db.auditLog.findMany({ where: { targetId }, orderBy: { createdAt: "asc" } });
  const idxs = async (editionId: string) => (await db.chapter.findMany({ where: { editionId }, orderBy: { idx: "asc" }, select: { title: true, idx: true } })).map((c) => `${c.idx}:${c.title}`);
  const add = (actor: { id: string }, editionId: string, title: string, body = "some words here") => saveChapter({ actor, editionId, title, body, isFreePreview: false });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { adminId: { in: made.users } } });
    await db.readingPosition.deleteMany({ where: { userId: { in: made.users } } });
    await db.bookmark.deleteMany({ where: { userId: { in: made.users } } });
    await db.entitlement.deleteMany({ where: { userId: { in: made.users } } });
    await db.user.deleteMany({ where: { id: { in: made.users } } });
    await db.work.deleteMany({ where: { id: { in: made.works } } });
    await db.$disconnect();
  });

  it("createBook makes an inactive draft, adds an edition to an existing slug, and audits once each", async () => {
    const admin = await user("owner");
    const slug = `ct-new-${stamp}`;
    const first = await createBook({ actor: { id: admin.id }, title: "T", slug, author: "Me", format: "EPUB", price: 300, currency: "kes" });
    made.works.push(first.workId);
    const second = await createBook({ actor: { id: admin.id }, title: "Ignored", slug, author: "Ignored", format: "AUDIOBOOK", price: 900, currency: "KES", narrator: "N" });
    expect(second.workId).toBe(first.workId);
    const edition = await db.edition.findUniqueOrThrow({ where: { id: first.editionId } });
    expect(edition).toMatchObject({ isActive: false, currency: "KES" });
    expect((await db.work.findUniqueOrThrow({ where: { id: first.workId } })).title).toBe("T");
    expect(await audit(first.editionId)).toHaveLength(1);
    expect(await audit(second.editionId)).toHaveLength(1);
    await expect(createBook({ actor: { id: admin.id }, title: "T", slug: "Bad Slug", author: "Me", format: "EPUB", price: 1, currency: "KES" })).rejects.toThrow();
  });

  it("appends chapters in order, then moves one; a draft needs no reason", async () => {
    const admin = await user("owner");
    const { edition } = await draft();
    const actor = { id: admin.id };
    const a = await add(actor, edition.id, "A");
    const b = await add(actor, edition.id, "B");
    await add(actor, edition.id, "C");
    expect([a.idx, b.idx]).toEqual([0, 1]);

    await moveChapter({ actor, chapterId: b.chapterId, dir: "up" });
    expect(await idxs(edition.id)).toEqual(["0:B", "1:A", "2:C"]);
    await expect(moveChapter({ actor, chapterId: b.chapterId, dir: "up" })).rejects.toThrow(/first chapter/);
    await moveChapter({ actor, chapterId: b.chapterId, dir: "down" });
    expect(await idxs(edition.id)).toEqual(["0:A", "1:B", "2:C"]);
  });

  it("editing a chapter updates the word count with the reader's tokenisation", async () => {
    const admin = await user("owner");
    const { edition } = await draft();
    const { chapterId } = await add({ id: admin.id }, edition.id, "A");
    await saveChapter({ actor: { id: admin.id }, editionId: edition.id, chapterId, title: "A2", body: " one two \r\n\r\n three ", isFreePreview: true });
    expect(await db.chapter.findUniqueOrThrow({ where: { id: chapterId } })).toMatchObject({ title: "A2", wordCount: 3, body: "one two \n\n three", isFreePreview: true });
  });

  it("move and delete are refused once a ReadingPosition or a Bookmark exists, but text edits still work", async () => {
    const admin = await user("owner");
    const reader = await user();
    const actor = { id: admin.id };
    for (const kind of ["position", "bookmark"] as const) {
      const { edition } = await draft();
      await add(actor, edition.id, "A");
      const b = await add(actor, edition.id, "B");
      if (kind === "position") await db.readingPosition.create({ data: { userId: reader.id, editionId: edition.id, locator: "0:3", progressPct: 1 } });
      else await db.bookmark.create({ data: { userId: reader.id, editionId: edition.id, chapterIdx: 0, position: 1 } });

      await expect(moveChapter({ actor, chapterId: b.chapterId, dir: "up" })).rejects.toThrow(/cannot be moved or removed/);
      await expect(deleteChapter({ actor, chapterId: b.chapterId })).rejects.toThrow(AdminError);
      expect(await idxs(edition.id)).toEqual(["0:A", "1:B"]);
      await saveChapter({ actor, editionId: edition.id, chapterId: b.chapterId, title: "B", body: "edited", isFreePreview: false });
    }
  });

  it("only the last chapter can be deleted", async () => {
    const admin = await user("owner");
    const actor = { id: admin.id };
    const { edition } = await draft();
    const a = await add(actor, edition.id, "A");
    const b = await add(actor, edition.id, "B");
    await expect(deleteChapter({ actor, chapterId: a.chapterId })).rejects.toThrow(/last chapter/);
    await deleteChapter({ actor, chapterId: b.chapterId });
    expect(await idxs(edition.id)).toEqual(["0:A"]);
    expect((await audit(b.chapterId)).map((r) => r.action)).toEqual(["chapter.added", "chapter.deleted"]);
  });

  it("every writer writes exactly one audit row and never puts chapter text in it", async () => {
    const admin = await user("owner");
    const actor = { id: admin.id };
    const { edition } = await draft();
    const a = await add(actor, edition.id, "A", SECRET);
    const b = await add(actor, edition.id, "B", SECRET);
    await saveChapter({ actor, editionId: edition.id, chapterId: a.chapterId, title: "A", body: `${SECRET} again`, isFreePreview: false });
    await moveChapter({ actor, chapterId: b.chapterId, dir: "up" });
    await deleteChapter({ actor, chapterId: a.chapterId });
    await importManuscript({ actor, editionId: edition.id, manuscript: `## X\n${SECRET}\n## Y\n${SECRET}` });

    const rowsA = await audit(a.chapterId);
    expect(rowsA.map((r) => r.action)).toEqual(["chapter.added", "chapter.saved", "chapter.deleted"]);
    expect((await audit(b.chapterId)).map((r) => r.action)).toEqual(["chapter.added", "chapter.moved"]);
    const imported = (await audit(edition.id)).filter((r) => r.action === "manuscript.imported");
    expect(imported).toHaveLength(1);
    const all = [...rowsA, ...(await audit(b.chapterId)), ...imported];
    expect(JSON.stringify(all.map((r) => r.meta))).not.toContain(SECRET);
    expect(rowsA[1].meta).toMatchObject({ wordsBefore: 1, wordsAfter: 2 });
    expect(JSON.stringify(rowsA[1].meta)).toMatch(/sha256After/);
  });

  it("a draft with no owners needs no reason; a live edition or an owned one does", async () => {
    const admin = await user("owner");
    const buyer = await user();
    const actor = { id: admin.id };

    const { edition: owned } = await draft();
    const c = await add(actor, owned.id, "A"); // no reason: fine
    await db.entitlement.create({ data: { userId: buyer.id, editionId: owned.id } });
    await expect(saveChapter({ actor, editionId: owned.id, chapterId: c.chapterId, title: "A", body: "x", isFreePreview: false })).rejects.toThrow(/reason/);
    await saveChapter({ actor, editionId: owned.id, chapterId: c.chapterId, title: "A", body: "x", isFreePreview: false, reason: REASON });

    const { edition: live } = await draft();
    await add(actor, live.id, "A");
    await setEditionActive({ editionId: live.id, active: true, actor, reason: REASON });
    await expect(add(actor, live.id, "B")).rejects.toThrow(/reason/);
    await saveChapter({ actor, editionId: live.id, title: "B", body: "y", isFreePreview: false, reason: REASON });
  });

  it("setEditionActive refuses to publish while something blocks it", async () => {
    const admin = await user("owner");
    const actor = { id: admin.id };

    const { edition: ebook } = await draft("EPUB");
    await expect(setEditionActive({ editionId: ebook.id, active: true, actor, reason: REASON })).rejects.toThrow(/not ready/);
    await add(actor, ebook.id, "Empty", "");
    await expect(setEditionActive({ editionId: ebook.id, active: true, actor, reason: REASON })).rejects.toThrow(/has no text/);
    expect((await db.edition.findUniqueOrThrow({ where: { id: ebook.id } })).isActive).toBe(false);

    const { edition: audio } = await draft("AUDIOBOOK");
    await add(actor, audio.id, "No audio", "");
    await expect(setEditionActive({ editionId: audio.id, active: true, actor, reason: REASON })).rejects.toThrow(/has no audio/);

    await db.edition.update({ where: { id: ebook.id }, data: { price: "0.00" } });
    await db.chapter.updateMany({ where: { editionId: ebook.id }, data: { body: "now has text" } });
    await expect(setEditionActive({ editionId: ebook.id, active: true, actor, reason: REASON })).rejects.toThrow(/price/);
    expect((await audit(ebook.id)).filter((r) => r.action === "edition.published")).toHaveLength(0);
  });

  it("getPublishIssues lists blocking problems and warns about a missing free preview", async () => {
    const admin = await user("owner");
    const { edition } = await draft();
    await add({ id: admin.id }, edition.id, "A", "text");
    expect(await getPublishIssues(edition.id)).toEqual({ blocking: [], warnings: [expect.stringMatching(/free preview/)] });
    await db.chapter.updateMany({ where: { editionId: edition.id }, data: { idx: 3, isFreePreview: true } });
    const issues = await getPublishIssues(edition.id);
    expect(issues.blocking[0]).toMatch(/out of order/);
    expect(issues.warnings).toEqual([]);
  });

  it("importManuscript appends chapters, and is refused on a live edition that has owners", async () => {
    const admin = await user("owner");
    const buyer = await user();
    const actor = { id: admin.id };
    const { edition } = await draft();
    await add(actor, edition.id, "Existing");
    expect(await importManuscript({ actor, editionId: edition.id, manuscript: "## One\nHello\n## Two\nWorld wide" })).toEqual({ added: 2 });
    expect(await idxs(edition.id)).toEqual(["0:Existing", "1:One", "2:Two"]);
    await expect(importManuscript({ actor, editionId: edition.id, manuscript: "no headings" })).rejects.toThrow(/No chapters/);

    await setEditionActive({ editionId: edition.id, active: true, actor, reason: REASON });
    await db.entitlement.create({ data: { userId: buyer.id, editionId: edition.id } });
    await expect(importManuscript({ actor, editionId: edition.id, manuscript: "## Three\nx", reason: REASON })).rejects.toThrow(/already owned/);
  });

  describe("attachChapterAudio", () => {
    async function audioChapter() {
      const admin = await user("owner");
      const { edition } = await draft("AUDIOBOOK");
      const chapter = await add({ id: admin.id }, edition.id, "Ch", "");
      return { actor: { id: admin.id }, edition, chapterId: chapter.chapterId };
    }
    const keyFor = (editionId: string, name: string) => `editions/${editionId}/audio/${name}`;

    it("attaches the file, replaces the previous one, syncs the edition length and audits once", async () => {
      const { actor, edition, chapterId } = await audioChapter();
      const first = keyFor(edition.id, `${chapterId}-aaaa.mp3`);
      const second = keyFor(edition.id, `${chapterId}-bbbb.mp3`);
      mocks.headObject.mockResolvedValue({ sizeBytes: 1_440_000, contentType: "audio/mpeg" }); // 120 s at 96 kbps

      await attachChapterAudio({ actor, chapterId, key: first, durationSeconds: 120 });
      const firstAsset = await db.chapter.findUniqueOrThrow({ where: { id: chapterId } });
      expect(firstAsset.durationSeconds).toBe(120);
      expect((await db.edition.findUniqueOrThrow({ where: { id: edition.id } })).durationSeconds).toBe(120);

      await attachChapterAudio({ actor, chapterId, key: second, durationSeconds: 60 }); // 192 kbps
      const after = await db.chapter.findUniqueOrThrow({ where: { id: chapterId } });
      expect(await db.asset.findMany({ where: { editionId: edition.id, kind: "AUDIO_FILE" } })).toHaveLength(1);
      expect(await db.asset.findUniqueOrThrow({ where: { id: after.assetId! } })).toMatchObject({ key: second, bucket: "prot", kind: "AUDIO_FILE" });
      expect(mocks.deleteObject).toHaveBeenCalledWith("prot", first);
      expect((await db.edition.findUniqueOrThrow({ where: { id: edition.id } })).durationSeconds).toBe(60);
      expect((await audit(chapterId)).filter((r) => r.action === "chapter.audio_attached")).toHaveLength(2);
    });

    it("rejects a key outside this book, a missing object, a wrong size for the length, and a crazy length", async () => {
      const { actor, edition, chapterId } = await audioChapter();
      const key = keyFor(edition.id, `${chapterId}-cccc.mp3`);

      await expect(attachChapterAudio({ actor, chapterId, key: "editions/other/audio/x.mp3", durationSeconds: 60 })).rejects.toThrow(/does not belong/);
      await expect(attachChapterAudio({ actor, chapterId, key: keyFor(edition.id, "../x.mp3"), durationSeconds: 60 })).rejects.toThrow(/does not belong/);

      mocks.headObject.mockResolvedValue(null);
      await expect(attachChapterAudio({ actor, chapterId, key, durationSeconds: 60 })).rejects.toThrow(/not found/);

      mocks.headObject.mockResolvedValue({ sizeBytes: 1_000, contentType: "audio/mpeg" }); // far too small: ~0.1 kbps
      await expect(attachChapterAudio({ actor, chapterId, key, durationSeconds: 60 })).rejects.toThrow(/does not match/);
      mocks.headObject.mockResolvedValue({ sizeBytes: 900_000_000, contentType: "audio/mpeg" }); // far too big for 60 s
      await expect(attachChapterAudio({ actor, chapterId, key, durationSeconds: 60 })).rejects.toThrow(/does not match/);

      mocks.headObject.mockResolvedValue({ sizeBytes: 1_440_000, contentType: "audio/mpeg" });
      await expect(attachChapterAudio({ actor, chapterId, key, durationSeconds: 0 })).rejects.toThrow();
      await expect(attachChapterAudio({ actor, chapterId, key, durationSeconds: 21_601 })).rejects.toThrow();
      expect(await db.asset.count({ where: { editionId: edition.id } })).toBe(0);
      expect((await audit(chapterId)).filter((r) => r.action === "chapter.audio_attached")).toHaveLength(0);
    });

    it("the presign route signs a key under the edition's audio prefix with the chapter id and a nonce", async () => {
      const { edition, chapterId } = await audioChapter();
      mocks.checkAdmin.mockResolvedValue({ ok: true, user: { id: "admin1" } });
      const req = new NextRequest("http://localhost/api/admin/chapter-audio", { method: "POST", body: JSON.stringify({ editionId: edition.id, chapterId, filename: "Part 1.M4A", contentType: "audio/mp4", sizeBytes: 1000 }) });
      const res = await POST(req, undefined);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.expiresIn).toBe(900);
      expect(body.key).toMatch(new RegExp(`^editions/${edition.id}/audio/${chapterId}-[0-9a-f]{12}\\.m4a$`));
      expect(mocks.getSignedUploadUrl).toHaveBeenCalledWith("prot", body.key, "audio/mp4", 900);
    });
  });

  it("getOwnedBook still returns a retired edition to its owner, and nothing to anyone else", async () => {
    const owner = await user();
    const stranger = await user();
    const { work, edition } = await draft();
    await db.entitlement.create({ data: { userId: owner.id, editionId: edition.id } });
    expect(edition.isActive).toBe(false); // retired and draft look the same to a reader
    const book = await getOwnedBook(work.slug, owner.id);
    expect(book?.editions.map((e) => e.id)).toEqual([edition.id]);
    expect(await getOwnedBook(work.slug, stranger.id)).toBeNull();
  });
});
