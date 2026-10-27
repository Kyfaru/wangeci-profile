import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/** Reads KEY=value lines from the env files the app itself uses (later files win; real env vars beat both). */
function fromEnvFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env.local", ".env.development.local"]) {
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

/** The database the tests use. Refuses anything that is not on this computer (these tests write and delete rows). */
export function testDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || fromEnvFiles().DATABASE_URL;
  if (!url) throw new Error("e2e: DATABASE_URL is not set (and not in .env.development.local).");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`e2e: refusing to run against DATABASE_URL host "${host}". Only a local database is allowed.`);
  }
  return url;
}

let client: PrismaClient | undefined;
export function db(): PrismaClient {
  client ??= new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
  return client;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const e2eEmail = () => `e2e-${uid()}@example.test`;
/** A unique Kenyan mobile number in E.164, e.g. +254712345678. */
export const e2ePhone = () => `+2547${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
/** The national part the checkout form wants after the +254 dial code. */
export const nationalOf = (e164: string) => e164.replace(/^\+254/, "");

/**
 * Removes everything e2e/inputs.spec.ts creates: accounts whose email starts with "e2e-", books whose address starts with
 * "e2e-inp-", coupons whose code starts with "E2EINP", and the sign-in codes left behind. Safe to run twice.
 */
export async function cleanupInputsRows() {
  const prisma = db();
  const users = await prisma.user.findMany({ where: { email: { startsWith: "e2e-" } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const works = await prisma.work.findMany({ where: { slug: { startsWith: "e2e-inp-" } }, select: { id: true, editions: { select: { id: true } } } });
  const editionIds = works.flatMap((w) => w.editions.map((e) => e.id));
  const steps = [
    () => prisma.readingPosition.deleteMany({ where: { OR: [{ editionId: { in: editionIds } }, { userId: { in: userIds } }] } }),
    () => prisma.bookmark.deleteMany({ where: { OR: [{ editionId: { in: editionIds } }, { userId: { in: userIds } }] } }),
    () => prisma.feedback.deleteMany({ where: { OR: [{ editionId: { in: editionIds } }, { userId: { in: userIds } }] } }),
    () => prisma.comment.deleteMany({ where: { OR: [{ postSlug: { startsWith: "e2e-inp-" } }, { userId: { in: userIds } }] } }),
    () => prisma.entitlement.deleteMany({ where: { OR: [{ editionId: { in: editionIds } }, { userId: { in: userIds } }] } }),
    () => prisma.order.deleteMany({ where: { userId: { in: userIds } } }),
    () => prisma.auditLog.deleteMany({ where: { adminId: { in: userIds } } }),
    () => prisma.chapter.deleteMany({ where: { editionId: { in: editionIds } } }),
    () => prisma.asset.deleteMany({ where: { editionId: { in: editionIds } } }),
    () => prisma.edition.deleteMany({ where: { id: { in: editionIds } } }),
    () => prisma.work.deleteMany({ where: { id: { in: works.map((w) => w.id) } } }),
    () => prisma.coupon.deleteMany({ where: { code: { startsWith: "E2EINP" } } }),
    () => prisma.verification.deleteMany({ where: { AND: [{ identifier: { contains: "e2e-" } }, { identifier: { contains: "@example.test" } }] } }),
    () => prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ];
  for (const step of steps) await step().catch((e: Error) => console.warn(`[e2e] inputs cleanup step skipped: ${e.message.split("\n").pop()}`));
}

/** Factory: a complete, valid account. Pass overrides for what the test cares about. */
export function createUser(overrides: { email?: string; phoneNumber?: string | null; name?: string } = {}) {
  return db().user.create({
    data: {
      name: overrides.name ?? "E2E Existing Reader",
      email: overrides.email ?? e2eEmail(),
      phoneNumber: overrides.phoneNumber === undefined ? e2ePhone() : overrides.phoneNumber,
      emailVerified: true,
      phoneNumberVerified: true,
    },
  });
}
