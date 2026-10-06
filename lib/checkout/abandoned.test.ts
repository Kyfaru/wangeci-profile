import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { purgeAbandonedGuestAccounts } from "./abandoned";

describe.skipIf(!url)("abandoned guest accounts (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();
  const ids: string[] = [];
  afterAll(async () => {
    await db.order.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });

  it("removes only old, unverified accounts with no orders, sessions or books", async () => {
    const old = new Date(Date.now() - 10 * 86_400_000);
    const make = async (n: string, data: object = {}) => {
      const u = await db.user.create({ data: { name: n, email: `ab-${stamp}-${n}@example.com`, createdAt: old, ...data } });
      ids.push(u.id);
      return u;
    };
    const orphan = await make("orphan");
    const verified = await make("verified", { emailVerified: true });
    const withOrder = await make("order");
    await db.order.create({ data: { userId: withOrder.id, totalAmount: "0", status: "FAILED" } });
    const fresh = await db.user.create({ data: { name: "fresh", email: `ab-${stamp}-fresh@example.com` } });
    ids.push(fresh.id);

    await purgeAbandonedGuestAccounts(new Date(Date.now() - 7 * 86_400_000));

    const left = (await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((u) => u.id);
    expect(left).not.toContain(orphan.id);
    expect(left).toEqual(expect.arrayContaining([verified.id, withOrder.id, fresh.id]));
  });
});
