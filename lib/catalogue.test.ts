import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

// Database test: runs only when TEST_DATABASE_URL points at a throwaway local database.
const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/r2", () => ({ publicUrl: (key: string) => `https://cdn.test/${key}` }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { getBookBySlug, getFreePreview, listBooks } from "./catalogue";

describe.skipIf(!url)("catalogue (database)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const slug = `cat-${Date.now()}`;

  afterAll(async () => {
    await prisma.work.deleteMany({ where: { slug } });
    await prisma.$disconnect();
  });

  it("serves only free-preview text, only active digital editions, per-edition prices", async () => {
    const work = await prisma.work.create({ data: { slug, title: "Cat Test", author: "A" } });
    const ebook = await prisma.edition.create({ data: { workId: work.id, format: "EPUB", price: "250.00" } });
    await prisma.edition.create({ data: { workId: work.id, format: "AUDIOBOOK", price: "400.00", isActive: false } }); // not for sale yet
    await prisma.edition.create({ data: { workId: work.id, format: "PAPERBACK", price: "900.00" } }); // digital only
    await prisma.chapter.createMany({
      data: [
        { editionId: ebook.id, idx: 0, title: "Free", body: "FREE TEXT", isFreePreview: true },
        { editionId: ebook.id, idx: 1, title: "Paid", body: "SECRET PAID TEXT", isFreePreview: false },
      ],
    });

    const book = await getBookBySlug(slug);
    expect(book?.editions.map((e) => [e.format, e.price])).toEqual([["ebook", 250]]);
    expect((await listBooks()).some((b) => b.slug === slug)).toBe(true);

    const preview = await getFreePreview(slug);
    expect(preview?.title).toBe("Free");
    expect(JSON.stringify(preview)).not.toContain("SECRET PAID TEXT");
    expect(JSON.stringify(book)).not.toContain("SECRET PAID TEXT");
  });

  it("returns nothing for a book with no active edition", async () => {
    const hidden = await prisma.work.create({ data: { slug: `${slug}-h`, title: "Hidden", author: "A" } });
    await prisma.edition.create({ data: { workId: hidden.id, format: "EPUB", price: "1.00", isActive: false } });
    expect(await getBookBySlug(`${slug}-h`)).toBeNull();
    await prisma.work.delete({ where: { id: hidden.id } });
  });
});
