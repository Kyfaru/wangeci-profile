import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

// Database tests run only when TEST_DATABASE_URL points at a throwaway local database.
const url = process.env.TEST_DATABASE_URL;

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { decideNewSession, grantReplaceConsent, revokeOtherSessions } from "./session-policy";

describe.skipIf(!url)("one active session per account (database)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();
  const email = `policy-${stamp}@example.com`;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("allows, blocks, and replaces only with consent", async () => {
    const user = await prisma.user.create({ data: { name: "P", email, emailVerified: true } });
    const who = { id: user.id, email: user.email, phoneNumber: null };

    expect(await decideNewSession(who)).toBe("allow"); // nobody signed in yet

    await prisma.session.create({ data: { userId: user.id, token: `a-${stamp}`, expiresAt: new Date(Date.now() + 60_000) } });
    expect(await decideNewSession(who)).toBe("block"); // second device, no consent

    await grantReplaceConsent(email.toUpperCase()); // case does not matter
    expect(await decideNewSession(who)).toBe("replace");
    expect(await decideNewSession(who)).toBe("block"); // consent is single use

    expect(await revokeOtherSessions(user.id)).toBe(1);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it("ignores expired sessions", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.session.create({ data: { userId: user.id, token: `old-${stamp}`, expiresAt: new Date(Date.now() - 1000) } });
    expect(await decideNewSession({ id: user.id, email, phoneNumber: null })).toBe("allow");
  });
});
