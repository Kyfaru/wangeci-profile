import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

// Database tests run only when TEST_DATABASE_URL points at a throwaway local database, e.g.
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/wangeci pnpm test
const url = process.env.TEST_DATABASE_URL;
const db = vi.hoisted(() => ({ client: undefined as unknown as import("@prisma/client").PrismaClient }));

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  db.client = new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } });
  return { prisma: db.client };
});

import { anonymiseUser } from "./anonymise-user";

describe.skipIf(!url)("anonymiseUser (database)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("blanks personal data but keeps the order and entitlement", async () => {
    const work = await prisma.work.create({ data: { title: "T", slug: `t-${stamp}`, author: "A" } });
    const edition = await prisma.edition.create({ data: { workId: work.id, format: "EPUB", price: "1.00" } });
    const user = await prisma.user.create({
      data: { name: "Real Person", email: `real-${stamp}@example.com`, emailVerified: true, phoneNumber: `+2547${String(stamp).slice(-8)}` },
    });
    const order = await prisma.order.create({
      data: { userId: user.id, totalAmount: "1.00", status: "PAID", items: { create: { editionId: edition.id, unitPrice: "1.00" } } },
    });
    await prisma.entitlement.create({ data: { userId: user.id, editionId: edition.id, orderId: order.id } });
    await prisma.session.create({ data: { userId: user.id, token: `tok-${stamp}`, expiresAt: new Date(Date.now() + 60_000) } });

    await anonymiseUser(user.id);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.name).toBe("Deleted reader");
    expect(after.email).toContain("anonymised.invalid");
    expect(after.phoneNumber).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.order.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(1);

    // clean up
    await prisma.entitlement.deleteMany({ where: { userId: user.id } });
    await prisma.order.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.edition.delete({ where: { id: edition.id } });
    await prisma.work.delete({ where: { id: work.id } });
  });
});
