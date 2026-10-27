import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});
const logError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/trace", () => ({ logError }));

import { memoryKv } from "./kv";
import {
  clearTotpFailures,
  countSmsToday,
  hasFreshStepUp,
  isSmsCountryAllowed,
  markStepUp,
  markUnproven,
  recordTotpFailure,
  settleFirstProof,
  TOTP_LOCK_SECONDS,
  totpLockedFor,
} from "./guards";

describe("step-up", () => {
  it("is fresh right after a code and stale after the window", async () => {
    const kv = memoryKv();
    expect(await hasFreshStepUp("u1", 5 * 60_000, kv)).toBe(false);
    await markStepUp("u1", kv, 1_000_000);
    expect(await hasFreshStepUp("u1", 5 * 60_000, kv, 1_000_000 + 4 * 60_000)).toBe(true);
    expect(await hasFreshStepUp("u1", 5 * 60_000, kv, 1_000_000 + 6 * 60_000)).toBe(false);
    expect(await hasFreshStepUp("u2", 5 * 60_000, kv, 1_000_000)).toBe(false); // per user
  });
});

describe("SMS guards", () => {
  afterEach(() => {
    delete process.env.SMS_ALLOWED_COUNTRY_CODES;
    delete process.env.SMS_DAILY_ALERT;
    logError.mockClear();
  });

  it("allows Kenya only by default, and what the env var lists otherwise", () => {
    expect(isSmsCountryAllowed("+254712345678")).toBe(true);
    expect(isSmsCountryAllowed("+447911123456")).toBe(false);
    process.env.SMS_ALLOWED_COUNTRY_CODES = "+254, +256";
    expect(isSmsCountryAllowed("+256712345678")).toBe(true);
    expect(isSmsCountryAllowed("+255712345678")).toBe(false);
  });

  it("counts sends per day and alerts once, on the crossing", async () => {
    process.env.SMS_DAILY_ALERT = "3";
    const kv = memoryKv();
    const day = new Date("2026-01-01T10:00:00Z");
    expect(await countSmsToday(kv, day)).toBe(1);
    await countSmsToday(kv, day);
    expect(logError).not.toHaveBeenCalled();
    expect(await countSmsToday(kv, day)).toBe(3);
    expect(logError).toHaveBeenCalledTimes(1);
    await countSmsToday(kv, day);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(await countSmsToday(kv, new Date("2026-01-02T00:00:01Z"))).toBe(1); // a new day starts again
  });
});

describe("authenticator guessing", () => {
  it("locks the step after 5 wrong codes and clears on success", async () => {
    const kv = memoryKv();
    const t0 = 5_000_000;
    for (let i = 0; i < 4; i++) expect(await recordTotpFailure("u1", kv, t0)).toBe(false);
    expect(await totpLockedFor("u1", kv, t0)).toBe(0);
    expect(await recordTotpFailure("u1", kv, t0)).toBe(true); // the 5th
    expect(await totpLockedFor("u1", kv, t0)).toBe(TOTP_LOCK_SECONDS);
    expect(await totpLockedFor("u1", kv, t0 + TOTP_LOCK_SECONDS * 1000 + 1)).toBe(0);

    await recordTotpFailure("u2", kv, t0);
    await clearTotpFailures("u2", kv);
    for (let i = 0; i < 4; i++) expect(await recordTotpFailure("u2", kv, t0)).toBe(false); // counter restarted
  });
});

describe.skipIf(!url)("first proof of an email (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();
  const email = `unproven-${stamp}@example.com`;
  const proven = `proven-${stamp}@example.com`;
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: { in: [email, proven] } } });
    await db.$disconnect();
  });

  it("clears an unverified phone and revokes older sessions, once", async () => {
    const kv = memoryKv();
    // Regression (pre-account hijack): a stranger's phone and session sit on the account before the owner arrives.
    const user = await db.user.create({ data: { name: "V", email, emailVerified: false, phoneNumber: `+2547${String(stamp).slice(-8)}`, phoneNumberVerified: false } });
    await db.session.create({ data: { userId: user.id, token: `old-${stamp}`, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(Date.now() - 5_000) } });

    await markUnproven(email, kv);
    const fresh = await db.session.create({ data: { userId: user.id, token: `new-${stamp}`, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(Date.now() + 1_000) } });
    expect(await settleFirstProof(email, kv)).toBe(true);

    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).phoneNumber).toBeNull();
    const left = await db.session.findMany({ where: { userId: user.id } });
    expect(left.map((s) => s.id)).toEqual([fresh.id]);
    expect(await settleFirstProof(email, kv)).toBe(false); // single use
  });

  it("does nothing for an account that already proved its email, and keeps a verified phone", async () => {
    const kv = memoryKv();
    const phone = `+2547${String(stamp).slice(-7)}1`;
    const user = await db.user.create({ data: { name: "P", email: proven, emailVerified: true, phoneNumber: phone, phoneNumberVerified: true } });
    await markUnproven(proven, kv);
    expect(await settleFirstProof(proven, kv)).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).phoneNumber).toBe(phone);
  });
});
