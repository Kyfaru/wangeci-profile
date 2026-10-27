import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

// Who may read an order, and what they see (needs the local database, see orders.test.ts).
const url = process.env.TEST_DATABASE_URL;

const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});
vi.mock("@/lib/server/session", () => ({ getSession: async () => (session.userId ? { user: { id: session.userId } } : null) }));

import { findOrderForViewer } from "@/lib/orders/access";
import { hashToken, newClaimToken } from "./guest";

describe.skipIf(!url)("order access (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();
  const made = { users: [] as string[] };

  afterAll(async () => {
    await db.order.deleteMany({ where: { userId: { in: made.users } } });
    await db.user.deleteMany({ where: { id: { in: made.users } } });
    await db.$disconnect();
  });

  async function orderWithToken(n: number, createdAt = new Date()) {
    const user = await db.user.create({ data: { name: "Jane Doe", email: `access-${stamp}-${n}@example.com` } });
    made.users.push(user.id);
    const claim = newClaimToken();
    const order = await db.order.create({ data: { userId: user.id, status: "PAID", totalAmount: "100.00", subtotalAmount: "100.00", currency: "KES", claimTokenHash: claim.hash, createdAt } });
    return { user, order, claim };
  }

  it("the token holder is not 'signed in', so callers mask the account; a wrong token gets nothing", async () => {
    const { order, claim } = await orderWithToken(1);
    session.userId = null;
    const found = await findOrderForViewer(order.id, claim.token);
    expect(found).toMatchObject({ signedIn: false });
    expect(await findOrderForViewer(order.id, "not-the-token-not-the-token")).toBeNull();
    expect(await findOrderForViewer(order.id, null)).toBeNull();
  });

  it("the signed-in owner is recognised without a token, a different user is not", async () => {
    const { order, user } = await orderWithToken(2);
    session.userId = user.id;
    expect(await findOrderForViewer(order.id, null)).toMatchObject({ signedIn: true });
    session.userId = "someone-else";
    expect(await findOrderForViewer(order.id, null)).toBeNull();
  });

  it("the token stops working after 24 hours, and a burned token (claimed account) never works", async () => {
    session.userId = null;
    const old = await orderWithToken(3, new Date(Date.now() - 25 * 3_600_000));
    expect(await findOrderForViewer(old.order.id, old.claim.token)).toBeNull();

    const burned = await orderWithToken(4);
    await db.order.update({ where: { id: burned.order.id }, data: { claimTokenHash: null } });
    expect(await findOrderForViewer(burned.order.id, burned.claim.token)).toBeNull();
    expect(hashToken(burned.claim.token)).toBe(burned.claim.hash);
  });
});
