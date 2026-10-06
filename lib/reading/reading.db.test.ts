import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

// Database tests: run only when TEST_DATABASE_URL points at a throwaway local database.
const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/r2", () => ({ getSignedDownloadUrl: async (bucket: string, key: string, ttl: number) => `https://signed.test/${bucket}/${key}?ttl=${ttl}` }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { audioTtlSeconds, grantChapterAudio } from "@/lib/media";
import { saveProgress } from "./progress";

describe("audio link lifetime", () => {
  it("is the chapter length plus a margin, never a day", () => {
    expect(audioTtlSeconds(600)).toBe(900);
    expect(audioTtlSeconds(null)).toBe(600); // minimum
    expect(audioTtlSeconds(10 * 3600)).toBe(3 * 3600); // capped
  });
});

describe.skipIf(!url)("reading and listening access (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const stamp = Date.now();
  const ids = { users: [] as string[], works: [] as string[] };

  afterAll(async () => {
    await db.entitlement.deleteMany({ where: { userId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.work.deleteMany({ where: { id: { in: ids.works } } });
    await db.$disconnect();
  });

  async function setup() {
    const user = await db.user.create({ data: { name: "R", email: `reader-${stamp}-${ids.users.length}@example.com`, emailVerified: true } });
    const work = await db.work.create({ data: { slug: `rw-${stamp}-${ids.works.length}`, title: "T", author: "A" } });
    ids.users.push(user.id);
    ids.works.push(work.id);
    const ebook = await db.edition.create({ data: { workId: work.id, format: "EPUB", price: "10.00" } });
    const audio = await db.edition.create({ data: { workId: work.id, format: "AUDIOBOOK", price: "20.00" } });
    await db.chapter.createMany({ data: [{ editionId: ebook.id, idx: 0, title: "A", wordCount: 100 }, { editionId: ebook.id, idx: 1, title: "B", wordCount: 300 }] });
    const asset = await db.asset.create({ data: { editionId: audio.id, kind: "AUDIO_FILE", bucket: "protected-test", key: "audio/0.mp3", mimeType: "audio/mpeg", sizeBytes: 1 } });
    await db.chapter.create({ data: { editionId: audio.id, idx: 0, title: "Ch", assetId: asset.id, durationSeconds: 120 } });
    await db.chapter.create({ data: { editionId: audio.id, idx: 1, title: "No file yet", durationSeconds: 60 } });
    return { user, ebook, audio };
  }

  it("saves progress only for owners, only for real chapters, and computes the percentage itself", async () => {
    const { user, ebook } = await setup();
    expect(await saveProgress({ userId: user.id, editionId: ebook.id, chapterIdx: 0, offset: 10 })).toBe("forbidden");

    await db.entitlement.create({ data: { userId: user.id, editionId: ebook.id } });
    expect(await saveProgress({ userId: user.id, editionId: ebook.id, chapterIdx: 9, offset: 10 })).toBe("invalid");
    expect(await saveProgress({ userId: user.id, editionId: ebook.id, chapterIdx: 1, offset: 100 })).toBe("saved");

    const row = await db.readingPosition.findUniqueOrThrow({ where: { userId_editionId: { userId: user.id, editionId: ebook.id } } });
    expect(row.locator).toBe("1:100");
    expect(row.progressPct).toBe(50); // (100 + 100) / 400
  });

  it("gives out an audio link only to owners of the audiobook, and stops when access is removed", async () => {
    const { user, ebook, audio } = await setup();
    const ask = (editionId: string, chapterIdx: number) => grantChapterAudio({ userId: user.id, editionId, chapterIdx });

    expect(await ask(audio.id, 0)).toBeNull(); // not owned
    await db.entitlement.create({ data: { userId: user.id, editionId: ebook.id } });
    expect(await ask(ebook.id, 0)).toBeNull(); // owns the ebook, which has no audio
    expect(await ask(audio.id, 0)).toBeNull(); // still does not own the audiobook

    await db.entitlement.create({ data: { userId: user.id, editionId: audio.id } });
    const grant = await ask(audio.id, 0);
    expect(grant?.url).toBe("https://signed.test/protected-test/audio/0.mp3?ttl=600"); // 120s + 300 margin, minimum 600
    expect(grant?.expiresInSeconds).toBe(600);
    expect(await ask(audio.id, 1)).toBeNull(); // chapter without a file
    expect(await ask(audio.id, 7)).toBeNull(); // no such chapter

    await db.entitlement.delete({ where: { userId_editionId: { userId: user.id, editionId: audio.id } } }); // e.g. a refund
    expect(await ask(audio.id, 0)).toBeNull(); // new links stop immediately
  });
});
