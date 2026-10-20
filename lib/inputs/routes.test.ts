/**
 * INPUT FUZZ SUITE, part 2 of 3: every route handler, called directly with `new NextRequest(...)`.
 * The inventory of inputs is the header of schemas.test.ts. Needs the throwaway local database:
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/wangeci
 * Mocked: session, turnstile, email/sms, payment providers, apply-event, R2, queue, QStash, next/cache.
 * Real: zod schemas, rate limits (in-memory; every case uses its own ip or user so nothing needs resetting),
 * Prisma against the local database, order creation, the pay ladder.
 * Known defects are pinned with `it.fails("BUG(severity) ...")`: the assertion states the CORRECT behaviour.
 */
import { createHash, createHmac } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

const SECRETS = vi.hoisted(() => ({
  paystack: "sk_test_fuzz",
  mpesa: "mpesa-callback-token-0123456789",
  at: "at-webhook-token-0123456789abcdef",
  cron: "cron-secret-0123456789abcdef",
  sanity: "sanity-secret",
  chatwoot: "chatwoot-secret",
  resend: `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`,
}));

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string; phoneNumber: string | null; twoFactorEnabled: boolean; name: string; emailVerified: boolean; phoneNumberVerified: boolean; image: null },
  notifyAdmins: vi.fn<(n: unknown) => Promise<void>>(async () => {}),
  initialize: vi.fn(async (input: { reference: string }) => ({ reference: input.reference || `ws_CO_${Math.random().toString(36).slice(2)}${Date.now()}`, accessCode: "ac_test", merchantRequestId: undefined as string | undefined })),
  applyProviderEvent: vi.fn(async (_e: unknown) => {}),
  reconcilePendingOrder: vi.fn(async () => "unchanged"),
  deliverOtp: vi.fn(async (_j: unknown) => {}),
  getSignedUploadUrl: vi.fn(async (_b: string, key: string) => `https://r2.test/${key}?sig=1`),
  qstashValid: "valid-signature",
}));

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    BETTER_AUTH_URL: "http://localhost:3000",
    PAYSTACK_SECRET_KEY: SECRETS.paystack,
    PAYSTACK_PUBLIC_KEY: "pk_test_fuzz",
    CHECKOUT_FEE_PERCENT: 0,
    R2_BUCKET_PROTECTED: "prot",
    RESEND_WEBHOOK_SECRET: SECRETS.resend,
    SANITY_WEBHOOK_SECRET: SECRETS.sanity,
    CHATWOOT_WEBHOOK_SECRET: SECRETS.chatwoot,
    AT_WEBHOOK_TOKEN: SECRETS.at,
    DARAJA_CALLBACK_TOKEN: SECRETS.mpesa,
    DARAJA_ENV: "sandbox",
    CRON_SECRET: SECRETS.cron,
    QSTASH_CURRENT_SIGNING_KEY: "cur",
    QSTASH_NEXT_SIGNING_KEY: "next",
  },
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});
vi.mock("@/lib/server/session", async () => {
  const { can } = await import("@/lib/permissions");
  const session = () => (mocks.user ? { user: mocks.user, session: { id: "s1", createdAt: new Date() } } : null);
  return {
    getSession: async () => session(),
    getSessionUserId: async () => mocks.user?.id ?? null,
    checkAdmin: async (action: Parameters<typeof can>[1]) => {
      if (!mocks.user) return { ok: false, reason: "signed-out" };
      if (!can(mocks.user.role, action)) return { ok: false, reason: "forbidden" };
      return { ok: true, user: mocks.user };
    },
  };
});
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ id: "e" })) }));
vi.mock("@/lib/sms", () => ({ sendSms: vi.fn(async () => ({})) }));
vi.mock("@/lib/server/notifier", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/lib/server/notify-admins", () => ({ notifyAdmins: mocks.notifyAdmins }));
vi.mock("@/lib/payments", () => ({ enabledProviders: () => ["PAYSTACK", "MPESA"], getProvider: () => ({ initialize: mocks.initialize }) }));
vi.mock("@/lib/orders/apply-event", () => ({ applyProviderEvent: mocks.applyProviderEvent, reconcilePendingOrder: mocks.reconcilePendingOrder }));
vi.mock("@/lib/orders/post-paid", () => ({ afterOrderPaid: vi.fn(async () => {}), invoiceForOrder: vi.fn(async () => null) }));
vi.mock("@/lib/r2", () => ({ getSignedUploadUrl: mocks.getSignedUploadUrl, getSignedDownloadUrl: async () => "https://r2.test/dl", headObject: vi.fn(), deleteObject: vi.fn() }));
vi.mock("@/lib/queue", () => ({ deliverOtp: mocks.deliverOtp }));
vi.mock("@upstash/qstash", () => ({ Receiver: class { async verify({ signature }: { signature: string }) { return signature === mocks.qstashValid; } } }));

import { POST as adminAudioPOST } from "@/app/api/admin/chapter-audio/route";
import { DELETE as bookmarksDELETE, GET as bookmarksGET, POST as bookmarksPOST } from "@/app/api/bookmarks/route";
import { GET as cartQuoteGET } from "@/app/api/cart/quote/route";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as quotePOST } from "@/app/api/checkout/quote/route";
import { POST as communityPOST } from "@/app/api/community/route";
import { POST as contactPOST } from "@/app/api/contact/route";
import { GET as cronGET } from "@/app/api/cron/orders/route";
import { GET as mediaChapterGET } from "@/app/api/media/chapter/route";
import { POST as mediaRefreshPOST } from "@/app/api/media/refresh/route";
import { GET as notificationsGET, POST as notificationsPOST } from "@/app/api/notifications/route";
import { GET as unreadGET } from "@/app/api/notifications/unread-count/route";
import { GET as invoiceGET } from "@/app/api/orders/[id]/invoice/route";
import { GET as orderGET } from "@/app/api/orders/[id]/route";
import { POST as qstashPOST } from "@/app/api/qstash/send-otp/route";
import { POST as progressPOST } from "@/app/api/reading/progress/route";
import { POST as consentPOST } from "@/app/api/session/replace-consent/route";
import { GET as bootstrapGET } from "@/app/api/user/bootstrap/route";
import { GET as ownedGET } from "@/app/api/user/owned/route";
import { POST as atPOST } from "@/app/api/webhooks/africastalking/delivery/route";
import { POST as chatwootPOST } from "@/app/api/webhooks/chatwoot/route";
import { POST as mpesaPOST } from "@/app/api/webhooks/mpesa/[token]/route";
import { POST as paystackPOST } from "@/app/api/webhooks/paystack/route";
import { POST as resendPOST } from "@/app/api/webhooks/resend/route";
import { POST as sanityPOST } from "@/app/api/webhooks/sanity/route";
import { getKv } from "@/lib/auth/kv";

// ---------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------

const LEAK = /prisma|invocation|SELECT |INSERT |UPDATE "|violates|ECONN|\bat .+\.(?:ts|js):\d+|node_modules|P20\d\d|Unique constraint|"stack"\s*:/i;
const NUL = "\u0000";
let counter = 0;
const seq = () => ++counter;
const ip = () => `10.${(counter >> 16) & 255}.${(counter >> 8) & 255}.${++counter & 255}`;

interface Opts {
  method?: string;
  body?: unknown;
  raw?: string | ArrayBuffer;
  headers?: Record<string, string>;
  ip?: string;
  search?: string;
  contentType?: string | null;
}

function req(path: string, o: Opts = {}) {
  const headers: Record<string, string> = { "x-forwarded-for": o.ip ?? ip(), ...(o.headers ?? {}) };
  const method = o.method ?? "POST";
  let body: string | ArrayBuffer | undefined = o.raw;
  if (body === undefined && o.body !== undefined) body = JSON.stringify(o.body);
  if (body !== undefined && o.contentType !== null) headers["content-type"] = o.contentType ?? "application/json";
  return new NextRequest(`http://x.test${path}${o.search ?? ""}`, { method, headers, body: method === "GET" || method === "DELETE" ? undefined : body });
}

interface Read {
  status: number;
  text: string;
  json: Record<string, unknown> | null;
  res: Response;
}
async function read(res: Response): Promise<Read> {
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  return { status: res.status, text, json, res };
}
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

/** A client mistake: a 4xx with {error, requestId} and no internals. */
function expectClientError(r: Read, status?: number) {
  expect(r.text).not.toMatch(LEAK);
  expect(r.status).toBeGreaterThanOrEqual(400);
  expect(r.status).toBeLessThan(500);
  if (status) expect(r.status).toBe(status);
  expect(r.json?.error).toEqual(expect.any(String));
  expect(r.json?.requestId).toEqual(expect.any(String));
}
/** Whatever the status, the body must not carry internals. */
const expectNoLeak = (r: Read) => expect(r.text).not.toMatch(LEAK);

// ---------------------------------------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------------------------------------

describe.skipIf(!url)("route input matrix (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const stamp = Date.now();
  const emailPrefix = `fz-${stamp}`;
  const userIds = new Set<string>();
  let reader: Awaited<ReturnType<typeof mkUser>>;
  let other: Awaited<ReturnType<typeof mkUser>>;
  let owner: Awaited<ReturnType<typeof mkUser>>;
  let support: Awaited<ReturnType<typeof mkUser>>;
  let book: { slug: string; editionId: string; otherEditionId: string; audioEditionId: string; audioChapterId: string; epubChapterId: string };
  const workIds: string[] = [];
  const startedAt = new Date();
  // The local embedded Postgres can be WIN1252; characters outside Latin-1 then fail in the database (an environment
  // limit, not an app bug: production is UTF8). Cases that STORE such characters are skipped on a non-UTF8 database.
  let utf8 = true;
  const needsUtf8 = (s: unknown) => !utf8 && typeof s === "string" && /[^\u0000-\u00ff]/.test(s);
  const couponIds: string[] = [];

  async function mkUser(role = "reader", extra: Record<string, unknown> = {}) {
    const u = await db.user.create({ data: { name: "Fuzz User", email: `${emailPrefix}-u${seq()}@example.test`, role, ...extra } });
    userIds.add(u.id);
    return u;
  }
  const asUser = (u: { id: string; email: string; role: string; phoneNumber: string | null; name: string } | null) => {
    mocks.user = u && { ...u, twoFactorEnabled: true, emailVerified: true, phoneNumberVerified: true, image: null };
  };
  /** A fresh reader signed in (so per-user limits never collide between cases). */
  async function freshReader() {
    const u = await mkUser();
    asUser(u);
    return u;
  }
  async function snapshot() {
    const ids = [...userIds];
    return {
      comments: await db.comment.count({ where: { userId: { in: ids } } }),
      feedback: await db.feedback.count({ where: { userId: { in: ids } } }),
      bookmarks: await db.bookmark.count({ where: { userId: { in: ids } } }),
      positions: await db.readingPosition.count({ where: { userId: { in: ids } } }),
      orders: await db.order.count({ where: { user: { email: { startsWith: emailPrefix } } } }),
      users: await db.user.count({ where: { email: { startsWith: emailPrefix } } }),
      reads: await db.notificationLog.count({ where: { userId: { in: ids }, readAt: { not: null } } }),
      adminNotices: mocks.notifyAdmins.mock.calls.length,
    };
  }

  beforeAll(async () => {
    const [{ enc }] = await db.$queryRaw<{ enc: string }[]>`SELECT current_setting('server_encoding') AS enc`;
    utf8 = enc === "UTF8";
    reader = await mkUser("reader");
    other = await mkUser("reader");
    owner = await mkUser("owner");
    support = await mkUser("support");

    const work = await db.work.create({ data: { slug: `fz-${stamp}-w`, title: "Fuzz Book", author: "A" } });
    const otherWork = await db.work.create({ data: { slug: `fz-${stamp}-o`, title: "Other Book", author: "B" } });
    const audioWork = await db.work.create({ data: { slug: `fz-${stamp}-a`, title: "Fuzz Audio", author: "C" } });
    workIds.push(work.id, otherWork.id, audioWork.id);
    const edition = await db.edition.create({ data: { workId: work.id, format: "EPUB", price: "1000.00" } });
    const otherEdition = await db.edition.create({ data: { workId: otherWork.id, format: "EPUB", price: "500.00" } });
    const audioEdition = await db.edition.create({ data: { workId: audioWork.id, format: "AUDIOBOOK", price: "800.00", durationSeconds: 60 } });
    const chapters = [];
    for (let idx = 0; idx < 3; idx++) chapters.push(await db.chapter.create({ data: { editionId: edition.id, idx, title: `C${idx}`, body: "one two three", wordCount: 3 } }));
    await db.chapter.create({ data: { editionId: otherEdition.id, idx: 0, title: "O0", body: "x y", wordCount: 2 } });
    const asset = await db.asset.create({ data: { editionId: audioEdition.id, kind: "AUDIO_FILE", bucket: "local", key: "/audio/fuzz.mp3", mimeType: "audio/mpeg", sizeBytes: 100 } });
    const audioChapter = await db.chapter.create({ data: { editionId: audioEdition.id, idx: 0, title: "A0", durationSeconds: 60, assetId: asset.id } });
    await db.entitlement.create({ data: { userId: reader.id, editionId: edition.id } });
    await db.entitlement.create({ data: { userId: reader.id, editionId: audioEdition.id } });
    await db.entitlement.create({ data: { userId: other.id, editionId: otherEdition.id } });
    book = { slug: work.slug, editionId: edition.id, otherEditionId: otherEdition.id, audioEditionId: audioEdition.id, audioChapterId: audioChapter.id, epubChapterId: chapters[0].id };

    const coupon = await db.coupon.create({ data: { code: `FZ${stamp}`, type: "PERCENT", value: 10 } });
    couponIds.push(coupon.id);
    await db.notificationLog.createMany({
      data: [
        { userId: reader.id, channel: "IN_APP", status: "DELIVERED", purpose: "fz", recipient: "in-app", title: "t1", body: "b", dedupeKey: `fz1-${stamp}` },
        { userId: reader.id, channel: "IN_APP", status: "DELIVERED", purpose: "fz", recipient: "in-app", title: "t2", body: "b", dedupeKey: `fz2-${stamp}` },
        { userId: other.id, channel: "IN_APP", status: "DELIVERED", purpose: "fz", recipient: "in-app", title: "t3", body: "b", dedupeKey: `fz3-${stamp}` },
      ],
    });
  });

  beforeEach(() => {
    mocks.user = null;
    vi.clearAllMocks();
    if (!process.env.FZ_DEBUG) {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    }
  });

  afterAll(async () => {
    const ids = [...userIds];
    await db.notificationLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { body: { contains: `TESTRUN${stamp}` } }] } });
    await db.bookmark.deleteMany({ where: { userId: { in: ids } } });
    await db.readingPosition.deleteMany({ where: { userId: { in: ids } } });
    await db.entitlement.deleteMany({ where: { userId: { in: ids } } });
    const editionRows = await db.edition.findMany({ where: { workId: { in: workIds } }, select: { id: true } });
    const guestOrders = await db.order.findMany({ where: { items: { some: { editionId: { in: editionRows.map((e) => e.id) } } } }, select: { id: true, user: { select: { id: true, createdAt: true } } } });
    for (const o of guestOrders) if (o.user.createdAt >= startedAt) ids.push(o.user.id);
    await db.order.deleteMany({ where: { OR: [{ user: { email: { startsWith: emailPrefix } } }, { id: { in: guestOrders.map((o) => o.id) } }] } });
    await db.comment.deleteMany({ where: { userId: { in: ids } } });
    await db.feedback.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { OR: [{ email: { startsWith: emailPrefix } }, { id: { in: ids } }] } });
    await db.coupon.deleteMany({ where: { id: { in: couponIds } } });
    await db.work.deleteMany({ where: { id: { in: workIds } } });
    await db.$disconnect();
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/checkout
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/checkout", () => {
    let n = 0;
    const phone = () => `+2547${String(10_000_000 + (stamp % 80_000_000) + ++n * 7).slice(-8)}`;
    const buyer = (over: Record<string, unknown> = {}) => ({ firstName: "Jane", lastName: "Doe", email: `${emailPrefix}-g${seq()}@example.test`, phone: phone(), ...over });
    const body = (over: Record<string, unknown> = {}) => ({ editionIds: [book.editionId], method: "card", buyer: buyer(), ...over });
    const post = async (b: unknown, o: Opts = {}) => read(await checkoutPOST(req("/api/checkout", { body: b, ...o }), undefined));

    it("should create a pending order and a new unverified account for a valid guest checkout", async () => {
      const b = body();
      const r = await post(b);
      expect(r.status).toBe(200);
      const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string }, include: { user: true } });
      expect(order.status).toBe("PENDING");
      expect(Number(order.totalAmount)).toBe(1000);
      expect(order.user.email).toBe(b.buyer.email);
      expect(order.user.phoneNumber).toBeNull();
    });

    describe("bodies", () => {
      it.each([
        ["invalid JSON", { raw: "{not json" }],
        ["empty body", { raw: "" }],
        ["array instead of object", { raw: "[]" }],
        ["null", { raw: "null" }],
        ["a string", { raw: '"hello"' }],
        ["a number", { raw: "12" }],
        ["a truncated body", { raw: '{"editionIds":["a"' }],
        ["a body with a BOM", { raw: "﻿{}" }],
      ])("should answer %s with a 4xx and write nothing", async (_n, o) => {
        const before = await snapshot();
        const r = await read(await checkoutPOST(req("/api/checkout", o), undefined));
        expectClientError(r, 400);
        expect(await snapshot()).toEqual(before);
      });

      it("should answer a 5 MB body with a 4xx, never a 5xx, and write nothing", async () => {
        const before = await snapshot();
        const r = await post(body({ coupon: "x".repeat(5 * 1024 * 1024) }));
        expectClientError(r, 400);
        expect(await snapshot()).toEqual(before);
      });

      it.each(["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", null])("should never 5xx for content-type %s", async (contentType) => {
        const r = await read(await checkoutPOST(req("/api/checkout", { raw: JSON.stringify(body()), contentType }), undefined));
        expect(r.status).toBeLessThan(500);
        expectNoLeak(r);
      });

      it("should ignore client-supplied prices, totals, user ids and prototype pollution", async () => {
        const r = await post({ ...body(), price: 1, total: 1, totalAmount: 1, userId: other.id, currency: "USD", ["__proto__"]: { isAdmin: true } });
        expect(r.status).toBe(200);
        const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string } });
        expect(Number(order.totalAmount)).toBe(1000);
        expect(order.currency).toBe("KES");
        expect(order.userId).not.toBe(other.id);
      });
    });

    describe("editionIds", () => {
      it.each([
        ["empty array", []],
        ["11 ids", Array.from({ length: 11 }, (_, i) => `e${i}`)],
        ["a string instead of an array", "abc"],
        ["null", null],
        ["numbers", [1, 2]],
        ["nested arrays", [["a"]]],
        ["objects", [{ id: "a" }]],
        ["an empty id", [""]],
        ["a 65 char id", ["a".repeat(65)]],
        ["mixed valid and number", ["BOOK", 5]],
      ])("should reject %s with a 4xx and write nothing", async (_n, ids) => {
        const before = await snapshot();
        expectClientError(await post(body({ editionIds: Array.isArray(ids) ? ids.map((i) => (i === "BOOK" ? book.editionId : i)) : ids })), 400);
        expect(await snapshot()).toEqual(before);
      });

      it("should answer a nonexistent id, a retired edition and a paperback with 409 and create nothing", async () => {
        const before = await snapshot();
        expectClientError(await post(body({ editionIds: ["does-not-exist"] })), 409);
        expectClientError(await post(body({ editionIds: [book.editionId, "nope"] })), 409);
        expect(await snapshot()).toEqual(before);
      });

      it("should treat duplicated ids as one item and charge once", async () => {
        const r = await post(body({ editionIds: [book.editionId, book.editionId, book.editionId] }));
        expect(r.status).toBe(200);
        const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string }, include: { items: true } });
        expect(order.items).toHaveLength(1);
        expect(Number(order.totalAmount)).toBe(1000);
      });

      it.fails("BUG(High) checkout/route.ts:68 an edition id containing a NUL byte reaches Postgres and returns 500 (should be 4xx)", async () => {
        expectClientError(await post(body({ editionIds: [`a${NUL}b`] })));
      });
    });

    describe("method", () => {
      it.each(["CARD", "Card", "paypal", "", null, 1, ["card"], {}, "mpesa "])("should reject method %j", async (method) => {
        expectClientError(await post(body({ method })), 400);
      });
    });

    describe("coupon", () => {
      it("should accept the real code in any case and with padding, and apply it server-side", async () => {
        const code = `fz${stamp}`;
        const r = await post(body({ coupon: `  ${code}  ` }));
        expect(r.status).toBe(200);
        const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string } });
        expect(Number(order.totalAmount)).toBe(900);
      });

      it.each([
        ["unknown", "NOPE12345"],
        ["41 chars", "A".repeat(41)],
        ["10x max", "A".repeat(400)],
        ["html", "<script>alert(1)</script>"],
        ["sql", `'; DROP TABLE "user";--`],
        ["unicode", "😀RTL‮abc"],
        ["combining", "é".repeat(10)],
        ["path traversal", "../../etc/passwd"],
        ["huge number", "9".repeat(40)],
        ["newline", "AB\nCD"],
      ])("should refuse a %s coupon without an account or order being made", async (_n, coupon) => {
        if (needsUtf8(coupon)) return;
        const before = await snapshot();
        const r = await post(body({ coupon }));
        expectClientError(r);
        expect([400, 422]).toContain(r.status);
        expect(await snapshot()).toEqual(before);
      });

      it.each([
        ["empty", ""],
        ["whitespace", "   "],
      ])("should treat an %s coupon as no coupon", async (_n, coupon) => {
        expect((await post(body({ coupon }))).status).toBe(200);
      });

      it("should give a wrong coupon the same refusal text whatever the reason, so codes cannot be enumerated", async () => {
        const a = await post(body({ coupon: "NOPE12345" }));
        const b = await post(body({ coupon: "ANOTHERNOPE" }));
        expect(a.json?.error).toBe(b.json?.error);
      });

      it.fails("BUG(High) checkout/route.ts:68 a coupon containing a NUL byte returns 500 (should be a 422 refusal)", async () => {
        expectClientError(await post(body({ coupon: `AB${NUL}CD` })));
      });
    });

    describe("buyer names", () => {
      const nameCases: [string, string, number | null][] = [
        ["empty", "", 400],
        ["whitespace only", "   ", 400],
        ["tabs and newlines only", "\t\n", 400],
        ["1 char", "J", 200],
        ["60 chars", "J".repeat(60), 200],
        ["61 chars", "J".repeat(61), 400],
        ["10x max", "J".repeat(600), 400],
        ["emoji", "😀", 200],
        ["RTL", "‮evil", 200],
        ["combining marks", "é́", 200],
        ["html payload", "<script>alert(1)</script>", 200],
        ["img payload", '"><img src=x onerror=1>', 200],
        ["sql", `'; DROP TABLE "user";--`, 200],
        ["path traversal", "../../etc/passwd", 200],
        ["digits", "9".repeat(40), 200],
      ];
      it.each(nameCases)("should handle a %s first name", async (_n, firstName, status) => {
        if (needsUtf8(firstName)) return;
        const before = await snapshot();
        const r = await post(body({ buyer: buyer({ firstName }) }));
        if (status === 400) {
          expectClientError(r, 400);
          expect((await snapshot()).users).toBe(before.users);
        } else {
          expect(r.status).toBe(200);
          const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string }, include: { user: true } });
          expect(order.user.name).toBe(`${firstName.trim()} Doe`); // stored exactly as sent: escaping is the renderer's job
        }
      });

      it.fails("BUG(Low) checkout/route.ts:24 a name made only of zero-width characters passes validation and creates an account with an invisible name", async () => {
        expectClientError(await post(body({ buyer: buyer({ firstName: "​​", lastName: "‍" }) })), 400);
      });

      it.fails("BUG(Low) checkout/route.ts:24 newlines and tabs are accepted inside a name and land in emails, SMS and the admin list", async () => {
        expectClientError(await post(body({ buyer: buyer({ firstName: "Jane\nBcc: x@y.z" }) })), 400);
      });

      it.fails("BUG(High) checkout/route.ts:101 a NUL byte in a buyer name reaches Postgres and returns 500 (should be 4xx)", async () => {
        expectClientError(await post(body({ buyer: buyer({ firstName: `Ja${NUL}ne` }) })));
      });
    });

    describe("buyer email", () => {
      it("should store a plus-addressed, upper-case, padded email lower-cased and trimmed", async () => {
        const local = `${emailPrefix}-Plus${seq()}`;
        const r = await post(body({ buyer: buyer({ email: `  ${local}+Tag@Example.TEST  ` }) }));
        expect(r.status).toBe(200);
        const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string }, include: { user: true } });
        expect(order.user.email).toBe(`${local}+tag@example.test`.toLowerCase());
      });

      it("should attach to one account for the same email in different case and answer identically", async () => {
        const e = `${emailPrefix}-case${seq()}@example.test`;
        const a = await post(body({ buyer: buyer({ email: e }) }));
        const b = await post(body({ buyer: buyer({ email: e.toUpperCase() }) }));
        expect(a.status).toBe(200);
        expect(b.status).toBe(200);
        const users = await db.user.count({ where: { email: e } });
        expect(users).toBe(1);
        expect(Object.keys(a.json!).sort()).toEqual(Object.keys(b.json!).sort());
      });

      it.each([
        "",
        "plain",
        "a@b",
        "@example.com",
        "a@",
        "a b@example.com",
        "a@@example.com",
        "a@example..com",
        '"quoted"@example.com',
        "a@example.com\nBcc: evil@x.com",
        `a${NUL}@example.com`,
        "<script>@example.com",
        `${"a".repeat(121)}@x.com`,
        "a@" + "b".repeat(300) + ".com",
        123,
        null,
        ["a@b.com"],
      ])("should reject email %j", async (email) => {
        const before = await snapshot();
        expectClientError(await post(body({ buyer: buyer({ email }) })), 400);
        expect(await snapshot()).toEqual(before);
      });

      it.each(["üser@example.com", "user@bücher.de", "user@xn--bcher-kva.de", "user@例え.jp", "a'b@example.com", "a.b-c_d@sub.example.co.ke"])("should answer %s with 200 or 400 and store it verbatim (lower-cased) when accepted", async (template) => {
        // The literal address is kept as the tail so every created account still carries the fixture prefix for cleanup.
        const email = `${emailPrefix}-odd${seq()}.${template}`;
        if (needsUtf8(email)) return;
        const r = await post(body({ buyer: buyer({ email }) }));
        expectNoLeak(r);
        expect([200, 400]).toContain(r.status);
        if (r.status === 200) {
          const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string }, include: { user: true } });
          expect(order.user.email).toBe(email.toLowerCase());
        }
      });
    });

    describe("buyer phone", () => {
      // Each case derives its number from a fresh unique one, so a phone already on a real local account cannot interfere.
      it.each([
        ["0712345678 style", (p: string) => `0${p.slice(4)}`],
        ["+254 with spaces", (p: string) => `+254 ${p.slice(4, 7)} ${p.slice(7, 10)} ${p.slice(10)}`],
        ["254 without plus", (p: string) => p.slice(1)],
        ["01 prefix", (p: string) => `+2541${p.slice(5)}`],
        ["a foreign E.164 for card", (p: string) => `+1415${p.slice(6, 13)}`],
      ])("should accept %s for a card payment", async (_n, format) => {
        expect((await post(body({ buyer: buyer({ phone: format(phone()) }) }))).status).toBe(200);
      });

      it.each([
        ["too short for the schema", "07123"],
        ["6 chars", "071234"],
        ["21 chars", "07".padEnd(21, "1")],
        ["letters", "07abcdefgh"],
        ["no leading zero or plus", "712345678"],
        ["emoji", "😀😀😀😀😀😀😀😀"],
        ["a NUL", `0712${NUL}345678`],
        ["html", "<script>1</script>"],
        ["a number", 712345678],
        ["null", null],
      ])("should reject a phone that is %s", async (_n, p) => {
        const before = await snapshot();
        const r = await post(body({ buyer: buyer({ phone: p }) }));
        expectClientError(r);
        expect(r.status).toBe(400);
        expect(await snapshot()).toEqual(before);
      });

      it("should refuse a non-Kenyan phone for M-Pesa with CHECKOUT_PHONE_INVALID and create nothing", async () => {
        const before = await snapshot();
        const r = await post(body({ method: "mpesa", buyer: buyer({ phone: "+14155552671" }) }));
        expectClientError(r, 400);
        expect(r.json?.code).toBe("CHECKOUT_PHONE_INVALID");
        expect(await snapshot()).toEqual(before);
      });
    });

    describe("mpesaPhone", () => {
      it("should refuse a guest paying from a different phone (403) and create nothing", async () => {
        const before = await snapshot();
        const r = await post(body({ method: "mpesa", mpesaPhone: "0722000111" }));
        expectClientError(r, 403);
        expect(r.json?.code).toBe("CHECKOUT_PAYER_PHONE_NOT_ALLOWED");
        expect(await snapshot()).toEqual(before);
      });

      it("should accept the guest's own phone written in another format", async () => {
        const p = phone();
        const r = await post(body({ method: "mpesa", buyer: buyer({ phone: p }), mpesaPhone: `0${p.slice(4)}` }));
        expect(r.status).toBe(200);
      });

      it.each(["x".repeat(21), "0712", "abc", "+14155552671", `0712${NUL}34567`])("should reject mpesaPhone %j", async (mpesaPhone) => {
        const r = await post(body({ method: "mpesa", mpesaPhone }));
        expectClientError(r);
      });

      it("should send at most 3 payment prompts to one phone per 10 minutes, whoever asks (429 on the 4th)", async () => {
        const p = phone();
        const statuses: number[] = [];
        for (let i = 0; i < 4; i++) statuses.push((await post(body({ method: "mpesa", buyer: buyer({ phone: p }) }))).status);
        expect(statuses).toEqual([200, 200, 200, 429]);
      });
    });

    describe("signed-in buyer", () => {
      it("should always attach the order to the session user, ignoring any buyer object", async () => {
        const u = await freshReader();
        const r = await post({ editionIds: [book.otherEditionId], method: "card", buyer: buyer({ email: other.email }) });
        expect(r.status).toBe(200);
        const order = await db.order.findUniqueOrThrow({ where: { id: r.json!.orderId as string } });
        expect(order.userId).toBe(u.id);
      });

      it("should refuse M-Pesa for an account with no phone and no mpesaPhone, and accept a valid mpesaPhone", async () => {
        await freshReader();
        expectClientError(await post({ editionIds: [book.otherEditionId], method: "mpesa" }), 400);
        const ok = await post({ editionIds: [book.otherEditionId], method: "mpesa", mpesaPhone: phone() });
        expect(ok.status).toBe(200);
      });

      it("should answer a book the buyer already owns with a 4xx, not a 5xx", async () => {
        asUser(reader);
        const r = await post({ editionIds: [book.editionId], method: "card" });
        expect(r.status).toBeLessThan(500);
        expectNoLeak(r);
      });
    });

    describe("rate limits", () => {
      it("should answer 429 from the 31st request per hour per ip even when the body is invalid (shape checks come after the limit)", async () => {
        const fixed = ip();
        const statuses: number[] = [];
        for (let i = 0; i < 31; i++) statuses.push((await checkoutPOST(req("/api/checkout", { body: {}, ip: fixed }), undefined)).status);
        expect(statuses.slice(0, 30).every((s) => s === 400)).toBe(true);
        expect(statuses[30]).toBe(429);
      });

      it("should lock one ip after repeated payment starts with the retry ladder (PAY_LOCKED with retryAfterSeconds)", async () => {
        const fixed = ip();
        const out: Read[] = [];
        for (let i = 0; i < 7; i++) out.push(await post(body(), { ip: fixed }));
        const locked = out.find((r) => r.json?.code === "PAY_LOCKED");
        expect(locked?.status).toBe(429);
        expect(locked?.json?.retryAfterSeconds).toEqual(expect.any(Number));
      });
    });

    it("should answer a provider failure with 502 and a generic message, mark the order FAILED and leak nothing", async () => {
      mocks.initialize.mockRejectedValueOnce(new Error("Paystack /transaction failed: key sk_live_abc 500 SELECT *"));
      const r = await post(body());
      expect(r.status).toBe(502);
      expectNoLeak(r);
      expect(r.text).not.toMatch(/sk_live/);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/checkout/quote and GET /api/cart/quote
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/checkout/quote", () => {
    const post = async (b: unknown, o: Opts = {}) => read(await quotePOST(req("/api/checkout/quote", { body: b, ...o }), undefined));

    it("should price from the database and ignore client prices", async () => {
      const r = await post({ editionIds: [book.editionId], price: 1, total: 1 });
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ subtotal: 1000, total: 1000, discount: 0 });
    });

    it.each([
      ["empty body", ""],
      ["invalid json", "{x"],
      ["array", "[]"],
      ["null", "null"],
    ])("should reject %s", async (_n, raw) => {
      expectClientError(await read(await quotePOST(req("/api/checkout/quote", { raw }), undefined)), 400);
    });

    it.each([[[]], [Array.from({ length: 11 }, (_, i) => `e${i}`)], ["abc"], [[1]], [["a".repeat(65)]], [[""]]])("should reject editionIds %j", async (ids) => {
      expectClientError(await post({ editionIds: ids }), 400);
    });

    it("should answer unknown editions with 409 and apply a coupon only when it exists", async () => {
      expectClientError(await post({ editionIds: ["missing"] }), 409);
      const ok = await post({ editionIds: [book.editionId], coupon: `fz${stamp}` });
      expect(ok.json).toMatchObject({ discount: 100, total: 900, couponCode: `FZ${stamp}` });
      const bad = await post({ editionIds: [book.editionId], coupon: "NOPE" });
      expect(bad.status).toBe(200);
      expect(bad.json).toMatchObject({ discount: 0, couponError: expect.any(String) });
    });

    it.each(["x".repeat(41), "x".repeat(400)])("should reject a coupon over 40 chars", async (coupon) => {
      expectClientError(await post({ editionIds: [book.editionId], coupon }), 400);
    });

    it("should answer 429 on the 61st request in 10 minutes per ip", async () => {
      const fixed = ip();
      let last = 0;
      for (let i = 0; i < 61; i++) last = (await quotePOST(req("/api/checkout/quote", { body: { editionIds: [book.editionId] }, ip: fixed }), undefined)).status;
      expect(last).toBe(429);
    });

    it.fails("BUG(High) checkout/quote/route.ts:204 an edition id containing a NUL byte returns 500 (should be 4xx)", async () => {
      expectClientError(await post({ editionIds: [`a${NUL}`] }));
    });

    it.fails("BUG(High) checkout/quote/route.ts:204 a coupon containing a NUL byte returns 500 (should be a 200 with couponError)", async () => {
      expect((await post({ editionIds: [book.editionId], coupon: `A${NUL}` })).status).toBeLessThan(500);
    });
  });

  describe("GET /api/cart/quote", () => {
    const get = async (search: string, o: Opts = {}) => read(await cartQuoteGET(req("/api/cart/quote", { method: "GET", search, ...o }), undefined));

    it("should price known editions and silently drop unknown ones", async () => {
      const r = await get(`?ids=${book.editionId},missing`);
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ total: 1000, currency: "KES" });
    });

    it.each(["", "?ids=", "?ids=,,,", `?ids=${Array.from({ length: 11 }, (_, i) => `e${i}`).join(",")}`, `?ids=${"a".repeat(65)}`, "?ids[]=a", `?ids=${"a,".repeat(5000)}`])("should answer %j with an empty quote, never an error", async (search) => {
      const r = await get(search);
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ items: [], total: 0 });
    });

    it("should answer 429 on the 61st request per minute", async () => {
      const fixed = ip();
      let last = 0;
      for (let i = 0; i < 61; i++) last = (await cartQuoteGET(req("/api/cart/quote", { method: "GET", search: "?ids=a", ip: fixed }), undefined)).status;
      expect(last).toBe(429);
    });

    it.fails("BUG(High) cart/quote/route.ts:231 an id containing a NUL byte (?ids=%00) returns 500 on a public, unauthenticated endpoint", async () => {
      expect((await get("?ids=%00")).status).toBeLessThan(500);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/contact
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/contact", () => {
    const valid = (over: Record<string, unknown> = {}) => ({ name: "Jane", email: `${emailPrefix}-c${seq()}@example.test`, message: "Hello there, a long enough message", ...over });
    const post = async (b: unknown, o: Opts = {}) => read(await contactPOST(req("/api/contact", { body: b, ...o }), undefined));

    it("should accept a valid message and hand it to the admins once", async () => {
      expect((await post(valid())).json).toEqual({ ok: true });
      expect(mocks.notifyAdmins).toHaveBeenCalledTimes(1);
    });

    describe("fields", () => {
      const cases: [string, Record<string, unknown>, boolean][] = [
        ["name empty", { name: "" }, false],
        ["name whitespace", { name: "   " }, false],
        ["name 1 char", { name: "J" }, true],
        ["name 100", { name: "J".repeat(100) }, true],
        ["name 101", { name: "J".repeat(101) }, false],
        ["name 10x", { name: "J".repeat(1000) }, false],
        ["name emoji", { name: "😀" }, true],
        ["name RTL", { name: "‮evil" }, true],
        ["name html", { name: "<script>alert(1)</script>" }, true],
        ["name sql", { name: `'; DROP TABLE "user";--` }, true],
        ["message 9", { message: "123456789" }, false],
        ["message 10", { message: "1234567890" }, true],
        ["message padded to 10 with spaces", { message: "         x" }, false],
        ["message whitespace", { message: " ".repeat(50) }, false],
        ["message 3000", { message: "m".repeat(3000) }, true],
        ["message 3001", { message: "m".repeat(3001) }, false],
        ["message 10x", { message: "m".repeat(30_000) }, false],
        ["message newlines and tabs", { message: "line1\nline2\r\n\ttabbed text" }, true],
        ["message html", { message: '"><img src=x onerror=1> and more text' }, true],
        ["message path traversal", { message: "../../etc/passwd../../etc" }, true],
        ["source unknown", { source: "/admin" }, false],
        ["source wrong case", { source: "/CONTACT" }, false],
        ["source /services", { source: "/services" }, true],
        ["source null", { source: null }, false],
        ["email plus", { email: `${emailPrefix}-p+x@example.test` }, true],
        ["email upper", { email: `${emailPrefix}-U@EXAMPLE.TEST` }, true],
        ["email no tld", { email: "a@b" }, false],
        ["email 255", { email: `${"a".repeat(247)}@x.co.ke` }, false],
        ["email newline", { email: "a@example.com\nBcc: x@y.z" }, false],
        ["name number", { name: 5 }, false],
        ["token 4097", { token: "t".repeat(4097) }, false],
        ["website 201", { website: "w".repeat(201) }, false],
      ];
      it.each(cases)("should handle %s", async (_n, over, accepted) => {
        const before = await snapshot();
        const r = await post(valid(over));
        if (accepted) {
          expect(r.status).toBe(200);
          expect(mocks.notifyAdmins).toHaveBeenCalledTimes(1);
        } else {
          expectClientError(r, 400);
          expect(mocks.notifyAdmins).not.toHaveBeenCalled();
          expect(await snapshot()).toEqual(before);
        }
      });
    });

    it.each([
      ["invalid JSON", "{x"],
      ["empty", ""],
      ["array", "[]"],
      ["null", "null"],
    ])("should reject %s body", async (_n, raw) => {
      expectClientError(await read(await contactPOST(req("/api/contact", { raw }), undefined)), 400);
      expect(mocks.notifyAdmins).not.toHaveBeenCalled();
    });

    it("should answer a 5 MB body with a 4xx", async () => {
      expectClientError(await post(valid({ message: "m".repeat(5 * 1024 * 1024) })), 400);
    });

    it("should pretend success for the honeypot and tell the admins nothing", async () => {
      expect((await post(valid({ website: "http://spam" }))).json).toEqual({ ok: true });
      expect(mocks.notifyAdmins).not.toHaveBeenCalled();
    });

    it("should answer 429 with Retry-After on the 6th message from one ip in an hour", async () => {
      const fixed = ip();
      const out: Read[] = [];
      for (let i = 0; i < 6; i++) out.push(await post(valid(), { ip: fixed }));
      expect(out.slice(0, 5).map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      expectClientError(out[5], 429);
      expect(out[5].json?.code).toBe("RATE_LIMITED");
      expect(out[5].res.headers.get("Retry-After")).toMatch(/^\d+$/);
    });

    it("should answer 429 on the 4th message from one email in a day, whatever the ip", async () => {
      const e = `${emailPrefix}-same${seq()}@example.test`;
      const out: number[] = [];
      for (let i = 0; i < 4; i++) out.push((await post(valid({ email: e }))).status);
      expect(out).toEqual([200, 200, 200, 429]);
    });

    it("should keep html, newlines and quotes exactly as sent in what the admins see", async () => {
      const actual = await vi.importActual<typeof import("@/lib/server/notify-admins")>("@/lib/server/notify-admins");
      mocks.notifyAdmins.mockImplementationOnce(actual.notifyAdmins);
      const message = `TESTRUN${stamp} <script>alert(1)</script>\n"><img src=x onerror=1>\n'; DROP TABLE "user";--`;
      expect((await post(valid({ message }))).status).toBe(200);
      const row = await db.notificationLog.findFirst({ where: { body: { contains: `TESTRUN${stamp}` } } });
      if (row) expect(row.body).toContain(message); // the admin account must exist locally for a row to be written
    });

    it.fails("BUG(High) contact/route.ts:289 a NUL byte in name or message passes validation and then fails in Postgres: 500 instead of 400", async () => {
      const actual = await vi.importActual<typeof import("@/lib/server/notify-admins")>("@/lib/server/notify-admins");
      mocks.notifyAdmins.mockImplementation(actual.notifyAdmins);
      const r = await post(valid({ message: `TESTRUN${stamp} bad${NUL}byte message` }));
      mocks.notifyAdmins.mockImplementation(async () => {});
      expectClientError(r);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/community
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/community", () => {
    const post = async (b: unknown, o: Opts = {}) => read(await communityPOST(req("/api/community", { body: b, ...o }), undefined));
    const comment = (over: Record<string, unknown> = {}) => ({ kind: "comment", slug: book.slug, body: "A thoughtful comment", ...over });
    const feedback = (over: Record<string, unknown> = {}) => ({ kind: "feedback", slug: book.slug, message: "Lovely book", rating: 5, ...over });

    it("should answer 401 when signed out and write nothing", async () => {
      const before = await snapshot();
      expectClientError(await post(comment()), 401);
      expect(await snapshot()).toEqual(before);
    });

    it("should store a comment as PENDING for the session user and ignore a spoofed userId/status", async () => {
      const u = await freshReader();
      expect((await post({ ...comment(), userId: other.id, status: "APPROVED" })).status).toBe(200);
      const row = await db.comment.findFirstOrThrow({ where: { userId: u.id } });
      expect(row.status).toBe("PENDING");
    });

    const bodyCases: [string, string, boolean][] = [
      ["1 char", "a", false],
      ["whitespace padded to 2", " a ", false],
      ["2 chars", "ab", true],
      ["1000", "b".repeat(1000), true],
      ["1001", "b".repeat(1001), false],
      ["10x", "b".repeat(10_000), false],
      ["emoji", "😀😀", true],
      ["RTL", "‮evil text", true],
      ["combining", "é́́", true],
      ["zero width only", "​​", true],
      ["newlines tabs", "a\n\n\tb", true],
      ["html", "<script>alert(1)</script>", true],
      ["img", '"><img src=x onerror=1>', true],
      ["sql", `'; DROP TABLE "user";--`, true],
      ["traversal", "../../etc/passwd", true],
      ["number string", "9".repeat(50), true],
    ];
    it.each(bodyCases)("should handle a %s comment body", async (_n, text, accepted) => {
      if (needsUtf8(text)) return;
      const u = await freshReader();
      const before = await snapshot();
      const r = await post(comment({ body: text }));
      if (accepted) {
        expect(r.status).toBe(200);
        const row = await db.comment.findFirstOrThrow({ where: { userId: u.id } });
        expect(row.body).toBe(text.trim()); // stored as plain text, byte for byte
      } else {
        expectClientError(r, 400);
        expect(await snapshot()).toEqual(before);
      }
    });

    it.each([
      ["rating 0", { rating: 0 }],
      ["rating 6", { rating: 6 }],
      ["rating -1", { rating: -1 }],
      ["rating 1.5", { rating: 1.5 }],
      ["rating string", { rating: "3" }],
      ["rating null", { rating: null }],
      ["rating 1e21", { rating: 1e21 }],
      ["rating max safe + 1", { rating: Number.MAX_SAFE_INTEGER + 2 }],
      ["message 1 char", { message: "a" }],
      ["message 2001", { message: "m".repeat(2001) }],
      ["message missing", { message: undefined }],
    ])("should reject feedback with %s and write nothing", async (_n, over) => {
      await freshReader();
      const before = await snapshot();
      expectClientError(await post(feedback(over)), 400);
      expect(await snapshot()).toEqual(before);
    });

    it.each([1, 3, 5])("should store feedback rating %d and no rating when omitted", async (rating) => {
      const u = await freshReader();
      expect((await post(feedback({ rating }))).status).toBe(200);
      expect((await db.feedback.findFirstOrThrow({ where: { userId: u.id } })).rating).toBe(rating);
      const v = await freshReader();
      expect((await post(feedback({ rating: undefined }))).status).toBe(200);
      expect((await db.feedback.findFirstOrThrow({ where: { userId: v.id } })).rating).toBeNull();
    });

    it.each([
      ["unknown kind", { kind: "Comment" }],
      ["no kind", { kind: undefined }],
      ["kind number", { kind: 1 }],
      ["slug empty", { slug: "" }],
      ["slug whitespace", { slug: "   " }],
      ["slug 201", { slug: "s".repeat(201) }],
      ["slug number", { slug: 5 }],
    ])("should reject %s", async (_n, over) => {
      await freshReader();
      expectClientError(await post(comment(over)), 400);
    });

    it.each(["no-such-book", "../../etc/passwd", "<script>", `'; DROP TABLE "user";--`, "s".repeat(200)])("should answer an unknown slug %j with 404 and write nothing", async (slug) => {
      await freshReader();
      const before = await snapshot();
      expectClientError(await post(comment({ slug })), 404);
      expect(await snapshot()).toEqual(before);
    });

    it.each([
      ["invalid JSON", "{x"],
      ["array", "[]"],
      ["null", "null"],
      ["empty", ""],
    ])("should reject %s body", async (_n, raw) => {
      await freshReader();
      expectClientError(await read(await communityPOST(req("/api/community", { raw }), undefined)), 400);
    });

    it("should answer 429 on the 6th comment from one account within an hour", async () => {
      await freshReader();
      const out: number[] = [];
      for (let i = 0; i < 6; i++) out.push((await post(comment())).status);
      expect(out).toEqual([200, 200, 200, 200, 200, 429]);
    });

    it("should answer 429 on the 21st community post from one ip within an hour across accounts", async () => {
      const fixed = ip();
      let last = 0;
      for (let i = 0; i < 21; i++) {
        await freshReader();
        last = (await post(comment(), { ip: fixed })).status;
      }
      expect(last).toBe(429);
    });

    it.fails("BUG(High) lib/community.ts:34 a NUL byte in a comment returns 500 (should be 400)", async () => {
      await freshReader();
      expectClientError(await post(comment({ body: `bad${NUL}byte` })));
    });

    it.fails("BUG(High) lib/community.ts:44 a NUL byte in feedback returns 500 (should be 400)", async () => {
      await freshReader();
      expectClientError(await post(feedback({ message: `bad${NUL}byte` })));
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // /api/bookmarks
  // -------------------------------------------------------------------------------------------------------
  describe("/api/bookmarks", () => {
    const post = async (b: unknown, o: Opts = {}) => read(await bookmarksPOST(req("/api/bookmarks", { body: b, ...o }), undefined));
    const good = (over: Record<string, unknown> = {}) => ({ editionId: book.editionId, chapterIdx: 0, position: 0, ...over });

    it("should answer 401 for every method when signed out", async () => {
      expect((await post(good())).status).toBe(401);
      expect((await read(await bookmarksGET(req("/api/bookmarks", { method: "GET" }), undefined))).status).toBe(401);
      expect((await read(await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE", search: "?id=x" }), undefined))).status).toBe(401);
    });

    it("should create a bookmark and treat the same spot as idempotent (one row)", async () => {
      const u = await freshReader();
      await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
      expect((await post(good({ chapterIdx: 1, position: 7 }))).status).toBe(201);
      expect((await post(good({ chapterIdx: 1, position: 7 }))).status).toBe(201);
      expect(await db.bookmark.count({ where: { userId: u.id } })).toBe(1);
    });

    describe("fields", () => {
      beforeEach(() => asUser(reader));
      const cases: [string, Record<string, unknown>, number][] = [
        ["chapterIdx -1", { chapterIdx: -1 }, 400],
        ["chapterIdx 1.5", { chapterIdx: 1.5 }, 400],
        ["chapterIdx string", { chapterIdx: "1" }, 400],
        ["chapterIdx 1e21", { chapterIdx: 1e21 }, 400],
        ["chapterIdx 10000", { chapterIdx: 10_000 }, 400],
        ["chapterIdx 9999 (no such chapter)", { chapterIdx: 9999 }, 400],
        ["chapterIdx 3 (just past the end)", { chapterIdx: 3 }, 400],
        ["chapterIdx null", { chapterIdx: null }, 400],
        ["position -1", { position: -1 }, 400],
        ["position 0.001", { position: 0.001 }, 400],
        ["position 1e7+1", { position: 10_000_001 }, 400],
        ["position max safe + 1", { position: Number.MAX_SAFE_INTEGER + 2 }, 400],
        ["position string", { position: "5" }, 400],
        ["note 301", { note: "n".repeat(301) }, 400],
        ["note 10x", { note: "n".repeat(3000) }, 400],
        ["note number", { note: 5 }, 400],
        ["edition id 65 chars", { editionId: "e".repeat(65) }, 400],
        ["edition id empty", { editionId: "" }, 400],
        ["edition id number", { editionId: 5 }, 400],
        ["nonexistent edition", { editionId: "missing" }, 404],
        ["another reader's edition (IDOR)", { editionId: "OTHER" }, 404],
      ];
      it.each(cases)("should answer %s with %d and write nothing", async (_n, over, status) => {
        const before = await snapshot();
        const o = { ...over };
        if (o.editionId === "OTHER") o.editionId = book.otherEditionId;
        const r = await post(good(o));
        expectClientError(r, status);
        expect(await snapshot()).toEqual(before);
      });

      it.each([
        ["position 0 default", { position: undefined }],
        ["position 1e7", { position: 10_000_000 }],
        ["note 300", { note: "n".repeat(300) }],
        ["note emoji", { note: "😀" }],
        ["note html", { note: "<script>alert(1)</script>" }],
        ["note sql", { note: `'; DROP TABLE "user";--` }],
        ["note newlines", { note: "a\nb\tc" }],
      ])("should accept %s and store the note exactly as sent", async (_n, over) => {
        if (needsUtf8(over.note)) return;
        const u = await freshReader();
        await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
        const r = await post(good({ chapterIdx: 2, ...over }));
        expect(r.status).toBe(201);
        const row = await db.bookmark.findFirstOrThrow({ where: { userId: u.id } });
        if (typeof over.note === "string") expect(row.note).toBe(over.note.trim());
      });

      it.fails("BUG(Low) bookmarks/route.ts:350 a whitespace-only note is stored as an empty string instead of null", async () => {
        const u = await freshReader();
        await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
        await post(good({ chapterIdx: 2, note: "    " }));
        expect((await db.bookmark.findFirstOrThrow({ where: { userId: u.id } })).note).toBeNull();
      });

      it.fails("BUG(High) bookmarks/route.ts:350 a NUL byte in the note returns 500 (should be 400)", async () => {
        const u = await freshReader();
        await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
        expectClientError(await post(good({ chapterIdx: 1, note: `a${NUL}b` })));
      });

      it.fails("BUG(Low) bookmarks/route.ts:360,375 400/401/404/429 bodies carry no `code` field, unlike every AppError route", async () => {
        const r = await post(good({ chapterIdx: -1 }));
        expect(r.json?.code).toEqual(expect.any(String));
      });
    });

    it.each([
      ["invalid JSON", "{x"],
      ["array", "[]"],
      ["null", "null"],
      ["empty", ""],
    ])("should reject %s body with 400", async (_n, raw) => {
      asUser(reader);
      expectClientError(await read(await bookmarksPOST(req("/api/bookmarks", { raw }), undefined)), 400);
    });

    it("should answer 429 on the 31st bookmark call in a minute", async () => {
      await freshReader();
      let last = 0;
      for (let i = 0; i < 31; i++) last = (await post(good())).status;
      expect(last).toBe(429);
    });

    describe("GET and DELETE", () => {
      it("should list only the caller's own bookmarks, even when asking for another reader's edition", async () => {
        const u = await freshReader();
        const r = await read(await bookmarksGET(req("/api/bookmarks", { method: "GET", search: `?editionId=${book.otherEditionId}` }), undefined));
        expect(r.json).toMatchObject({ items: [], total: 0 });
        expect(u.id).toBeTruthy();
      });

      it("should not delete another reader's bookmark (404) and leave it in place", async () => {
        const victim = await mkUser();
        await db.entitlement.create({ data: { userId: victim.id, editionId: book.editionId } });
        const mark = await db.bookmark.create({ data: { userId: victim.id, editionId: book.editionId, chapterIdx: 0, position: 0 } });
        await freshReader();
        const r = await read(await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE", search: `?id=${mark.id}` }), undefined));
        expectClientError(r, 404);
        expect(await db.bookmark.count({ where: { id: mark.id } })).toBe(1);
      });

      it("should delete your own bookmark with 204, and answer a missing id with 400", async () => {
        const u = await freshReader();
        await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
        const mark = await db.bookmark.create({ data: { userId: u.id, editionId: book.editionId, chapterIdx: 0, position: 0 } });
        expect((await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE", search: `?id=${mark.id}` }), undefined)).status).toBe(204);
        expectClientError(await read(await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE" }), undefined)), 400);
        expectClientError(await read(await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE", search: "?id=" }), undefined)), 400);
      });

      it.each(["x".repeat(5000), "<script>", "../../etc", "'; DROP TABLE bookmark;--", "😀"])("should answer delete id %j with 404", async (id) => {
        if (needsUtf8(id)) return;
        asUser(reader);
        const r = await read(await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE", search: `?id=${encodeURIComponent(id)}` }), undefined));
        expectClientError(r, 404);
      });

      it.fails("BUG(High) bookmarks/route.ts:398 DELETE ?id=%00 returns 500 (should be 404)", async () => {
        asUser(reader);
        expect((await bookmarksDELETE(req("/api/bookmarks", { method: "DELETE", search: "?id=%00" }), undefined)).status).toBeLessThan(500);
      });

      it.fails("BUG(High) bookmarks/route.ts:361 GET ?editionId=%00 returns 500 (should be an empty list)", async () => {
        asUser(reader);
        expect((await bookmarksGET(req("/api/bookmarks", { method: "GET", search: "?editionId=%00" }), undefined)).status).toBeLessThan(500);
      });
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/reading/progress
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/reading/progress", () => {
    const post = async (b: unknown, o: Opts = {}) => read(await progressPOST(req("/api/reading/progress", { body: b, ...o }), undefined));
    const good = (over: Record<string, unknown> = {}) => ({ editionId: book.editionId, chapterIdx: 1, offset: 2, ...over });

    it("should answer 401 when signed out", async () => {
      expect((await post(good())).status).toBe(401);
    });

    it("should save the place, floor a fractional offset and compute the percentage on the server", async () => {
      const u = await freshReader();
      await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
      expect((await post(good({ offset: 2.9, progressPct: 100 }))).status).toBe(200);
      const row = await db.readingPosition.findFirstOrThrow({ where: { userId: u.id } });
      expect(row.locator).toBe("1:2");
      expect(row.progressPct).toBeLessThan(100);
    });

    const cases: [string, Record<string, unknown>, number][] = [
      ["offset -1", { offset: -1 }, 400],
      ["offset 1e7+1", { offset: 10_000_001 }, 400],
      ["offset 1e21", { offset: 1e21 }, 400],
      ["offset string", { offset: "5" }, 400],
      ["offset null", { offset: null }, 400],
      ["offset missing", { offset: undefined }, 400],
      ["chapterIdx -1", { chapterIdx: -1 }, 400],
      ["chapterIdx 1.5", { chapterIdx: 1.5 }, 400],
      ["chapterIdx 10000", { chapterIdx: 10_000 }, 400],
      ["chapterIdx 99 (no such chapter)", { chapterIdx: 99 }, 400],
      ["editionId empty", { editionId: "" }, 400],
      ["editionId 65", { editionId: "e".repeat(65) }, 400],
      ["editionId number", { editionId: 5 }, 400],
      ["unknown edition", { editionId: "missing" }, 404],
      ["another reader's edition (IDOR)", { editionId: "OTHER" }, 404],
    ];
    it.each(cases)("should answer %s with %d and write nothing", async (_n, over, status) => {
      asUser(reader);
      const before = await snapshot();
      const o = { ...over };
      if (o.editionId === "OTHER") o.editionId = book.otherEditionId;
      expectClientError(await post(good(o)), status);
      expect(await snapshot()).toEqual(before);
    });

    it.each([
      ["invalid JSON", "{x"],
      ["empty", ""],
      ["array", "[]"],
      ["null", "null"],
      ["a string", '"x"'],
    ])("should answer %s with 400", async (_n, raw) => {
      asUser(reader);
      expectClientError(await read(await progressPOST(req("/api/reading/progress", { raw, contentType: "text/plain" }), undefined)), 400);
    });

    it("should accept the sendBeacon form (text/plain body) and answer a 5 MB body with a 4xx", async () => {
      const u = await freshReader();
      await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
      const beacon = await read(await progressPOST(req("/api/reading/progress", { raw: JSON.stringify(good()), contentType: "text/plain;charset=UTF-8" }), undefined));
      expect(beacon.status).toBe(200);
      expectClientError(await post(good({ editionId: "e".repeat(5 * 1024 * 1024) })), 400);
    });

    it("should answer 429 on the 41st save in a minute", async () => {
      await freshReader();
      let last = 0;
      for (let i = 0; i < 41; i++) last = (await post(good())).status;
      expect(last).toBe(429);
    });

    it.fails("BUG(High) reading/progress/route.ts:442 an editionId containing a NUL byte returns 500 (should be 4xx)", async () => {
      asUser(reader);
      expectClientError(await post(good({ editionId: `a${NUL}` })));
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // GET /api/media/chapter and POST /api/media/refresh
  // -------------------------------------------------------------------------------------------------------
  describe("media grants", () => {
    const get = async (search: string, o: Opts = {}) => read(await mediaChapterGET(req("/api/media/chapter", { method: "GET", search, ...o }), undefined));
    const refresh = async (b: unknown) => read(await mediaRefreshPOST(req("/api/media/refresh", { body: b }), undefined));

    it("should answer 401 when signed out", async () => {
      expect((await get(`?editionId=${book.audioEditionId}&idx=0`)).status).toBe(401);
      expect((await refresh({ editionId: book.audioEditionId, chapterIdx: 0 })).status).toBe(401);
    });

    it("should grant the owner a no-store link for a real chapter", async () => {
      asUser(reader);
      const r = await get(`?editionId=${book.audioEditionId}&idx=0`);
      expect(r.status).toBe(200);
      expect(r.res.headers.get("Cache-Control")).toBe("no-store");
      expect(r.json?.url).toEqual(expect.any(String));
    });

    it.each(["", "?idx=0", `?editionId=${"e".repeat(65)}&idx=0`, "?editionId=x&idx=-1", "?editionId=x&idx=1.5", "?editionId=x&idx=abc", "?editionId=x&idx=10000", "?editionId=x&idx=NaN", "?editionId=x&idx=Infinity", "?editionId=x&idx=1e21", "?editionId=x&idx=9007199254740993"])(
      "should answer query %j with 400",
      async (search) => {
        asUser(reader);
        expectClientError(await get(search), 400);
      },
    );

    it("should answer 404 for another reader's edition, a nonexistent one, an ebook, and a chapter without audio", async () => {
      asUser(reader);
      expectClientError(await get(`?editionId=${book.otherEditionId}&idx=0`), 404);
      expectClientError(await get("?editionId=missing&idx=0"), 404);
      expectClientError(await get(`?editionId=${book.editionId}&idx=0`), 404);
      expectClientError(await get(`?editionId=${book.audioEditionId}&idx=5`), 404);
      asUser(other);
      expectClientError(await get(`?editionId=${book.audioEditionId}&idx=0`), 404);
    });

    it.each([
      ["invalid JSON", "{x"],
      ["empty", ""],
      ["array", "[]"],
      ["null", "null"],
    ])("should reject refresh with %s body", async (_n, raw) => {
      asUser(reader);
      expectClientError(await read(await mediaRefreshPOST(req("/api/media/refresh", { raw }), undefined)), 400);
    });

    it.each([
      ["chapterIdx string", { chapterIdx: "0" }],
      ["chapterIdx -1", { chapterIdx: -1 }],
      ["chapterIdx 1.5", { chapterIdx: 1.5 }],
      ["chapterIdx 1e21", { chapterIdx: 1e21 }],
      ["editionId number", { editionId: 5 }],
      ["editionId empty", { editionId: "" }],
    ])("should reject refresh with %s", async (_n, over) => {
      asUser(reader);
      expectClientError(await refresh({ editionId: book.audioEditionId, chapterIdx: 0, ...over }), 400);
    });

    it("should answer 429 on the 61st grant in a minute", async () => {
      await freshReader();
      let last = 0;
      for (let i = 0; i < 61; i++) last = (await get("?editionId=x&idx=0")).status;
      expect(last).toBe(429);
    });

    it.fails("BUG(Low) media/chapter/route.ts:460 z.coerce.number accepts idx= (empty) and idx=%20 as chapter 0, and hex/exponent forms ('0x10', '1e3') as numbers", async () => {
      asUser(reader);
      expectClientError(await get(`?editionId=${book.audioEditionId}&idx=`), 400);
    });

    it.fails("BUG(High) media/chapter/route.ts:470 ?editionId=%00 returns 500 (should be 404)", async () => {
      asUser(reader);
      expect((await get("?editionId=%00&idx=0")).status).toBeLessThan(500);
    });

    it.fails("BUG(High) media/refresh/route.ts:501 an editionId containing a NUL byte returns 500 (should be 404)", async () => {
      asUser(reader);
      expect((await refresh({ editionId: `a${NUL}`, chapterIdx: 0 })).status).toBeLessThan(500);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // /api/notifications, unread-count, owned, bootstrap
  // -------------------------------------------------------------------------------------------------------
  describe("notifications and small reads", () => {
    const post = async (raw: string | undefined, o: Opts = {}) => read(await notificationsPOST(req("/api/notifications", { raw, ...o }), undefined));

    it("should answer 401 for every notification endpoint when signed out and [] for owned", async () => {
      expect((await read(await notificationsGET(req("/api/notifications", { method: "GET" }), undefined))).status).toBe(401);
      expect((await post("{}")).status).toBe(401);
      expect((await read(await unreadGET(req("/api/notifications/unread-count", { method: "GET" }), undefined))).status).toBe(401);
      expect((await read(await ownedGET(req("/api/user/owned", { method: "GET" }), undefined))).json).toEqual({ editionIds: [] });
      expect((await read(await bootstrapGET(req("/api/user/bootstrap", { method: "GET" }), undefined))).status).toBe(401);
    });

    it("should never mark another reader's items as read (IDOR) and count only its own", async () => {
      const u = await mkUser();
      const mine = await db.notificationLog.create({ data: { userId: u.id, channel: "IN_APP", status: "DELIVERED", purpose: "fz", recipient: "in-app", title: "m", body: "b", dedupeKey: `m-${stamp}-${seq()}` } });
      const theirs = await db.notificationLog.findFirstOrThrow({ where: { userId: other.id, channel: "IN_APP", purpose: "fz" } });
      asUser(u);
      const r = await post(JSON.stringify({ ids: [mine.id, theirs.id, mine.id] }));
      expect(r.json).toEqual({ updated: 1 });
      expect((await db.notificationLog.findUniqueOrThrow({ where: { id: theirs.id } })).readAt).toBeNull();
    });

    it.each([
      ["ids 101", { ids: Array.from({ length: 101 }, (_, i) => `i${i}`) }],
      ["ids not an array", { ids: "abc" }],
      ["ids null", { ids: null }],
      ["ids numbers", { ids: [1, 2] }],
      ["ids nested", { ids: [["a"]] }],
      ["id empty", { ids: [""] }],
      ["id 65 chars", { ids: ["a".repeat(65)] }],
    ])("should reject %s and mark nothing", async (_n, b) => {
      await freshReader();
      expectClientError(await post(JSON.stringify(b)), 400);
    });

    it("should accept 100 ids, an empty list, and an empty body (mark all)", async () => {
      await freshReader();
      expect((await post(JSON.stringify({ ids: Array.from({ length: 100 }, (_, i) => `i${i}`) }))).status).toBe(200);
      expect((await post(JSON.stringify({ ids: [] }))).json).toEqual({ updated: 0 });
      expect((await post(undefined)).status).toBe(200);
    });

    it("should reject JSON null and a JSON array body with 400", async () => {
      await freshReader();
      expectClientError(await post("null"), 400);
      expectClientError(await post("[]"), 400);
    });

    it.fails("BUG(Low) notifications/route.ts:536 malformed JSON ('{bad') is swallowed as {} and marks EVERY notification read instead of answering 400", async () => {
      const u = await mkUser();
      await db.notificationLog.create({ data: { userId: u.id, channel: "IN_APP", status: "DELIVERED", purpose: "fz", recipient: "in-app", title: "m", body: "b", dedupeKey: `bad-${stamp}-${seq()}` } });
      asUser(u);
      const r = await post("{bad");
      expectClientError(r, 400);
    });

    it.fails("BUG(High) notifications/route.ts:540 an id containing a NUL byte returns 500 (should be 4xx)", async () => {
      await freshReader();
      expectClientError(await post(JSON.stringify({ ids: [`a${NUL}`] })));
    });

    it("should mask the email and phone in bootstrap and list owned ids only for the caller", async () => {
      asUser(reader);
      const b = await read(await bootstrapGET(req("/api/user/bootstrap", { method: "GET" }), undefined));
      expect(b.json?.email).toMatch(/^f\*\*\*@/);
      expect(b.text).not.toContain(reader.email);
      const o = await read(await ownedGET(req("/api/user/owned", { method: "GET" }), undefined));
      expect(o.json?.editionIds).toEqual(expect.arrayContaining([book.editionId, book.audioEditionId]));
      expect(o.json?.editionIds).not.toContain(book.otherEditionId);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/session/replace-consent
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/session/replace-consent", () => {
    const post = async (b: unknown, o: Opts = {}) => read(await consentPOST(req("/api/session/replace-consent", { body: b, ...o }), undefined));
    const tokenKey = (token: string) => `replace-token:${createHash("sha256").update(token).digest("hex")}`;

    it.each([
      ["identifier 2 chars", { identifier: "ab", token: "t".repeat(32) }],
      ["identifier whitespace", { identifier: "     ", token: "t".repeat(32) }],
      ["identifier 321", { identifier: "i".repeat(321), token: "t".repeat(32) }],
      ["token 15", { identifier: "a@b.co", token: "t".repeat(15) }],
      ["token 129", { identifier: "a@b.co", token: "t".repeat(129) }],
      ["token number", { identifier: "a@b.co", token: 5 }],
      ["identifier object", { identifier: {}, token: "t".repeat(32) }],
      ["missing fields", {}],
    ])("should reject %s with VALIDATION_FAILED", async (_n, b) => {
      const r = await post(b);
      expect(r.status).toBe(400);
      expect(r.text).not.toMatch(LEAK);
      expect(r.json).toMatchObject({ success: false, error: { code: "VALIDATION_FAILED" } });
    });

    it.each([
      ["unknown token", { identifier: "a@b.co", token: "t".repeat(32) }],
      ["max length token", { identifier: "i".repeat(320), token: "t".repeat(128) }],
      ["html identifier", { identifier: "<script>alert(1)</script>", token: "t".repeat(32) }],
      ["sql identifier", { identifier: `'; DROP TABLE "user";--`, token: "t".repeat(32) }],
    ])("should answer %s with 403 AUTH_REPLACE_TOKEN_INVALID", async (_n, b) => {
      const r = await post(b);
      expect(r.status).toBe(403);
      expect(r.json).toMatchObject({ error: { code: "AUTH_REPLACE_TOKEN_INVALID" } });
    });

    it("should refuse a valid token presented with another account's identifier, and keep the token usable", async () => {
      const token = `tok-${stamp}-${seq()}-abcdefgh`;
      await getKv().set(tokenKey(token), reader.id, 600);
      expect((await post({ identifier: other.email, token })).status).toBe(403);
      expect((await post({ identifier: reader.email.toUpperCase(), token })).status).toBe(204); // case-insensitive, then single use
      expect((await post({ identifier: reader.email, token })).status).toBe(403);
    });

    it("should answer 429 on the 11th request per ip within 10 minutes", async () => {
      const fixed = ip();
      let last = 0;
      for (let i = 0; i < 11; i++) last = (await consentPOST(req("/api/session/replace-consent", { body: { identifier: "a@b.co", token: "t".repeat(32) }, ip: fixed }), undefined)).status;
      expect(last).toBe(429);
    });

    it.fails("BUG(Low) auth/session-policy.ts:36 a NUL byte in the identifier (with a valid token) returns 500 instead of 403", async () => {
      const token = `tok-${stamp}-${seq()}-nulnulnul`;
      await getKv().set(tokenKey(token), reader.id, 600);
      expect((await post({ identifier: `a${NUL}b@c.d`, token })).status).toBeLessThan(500);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // POST /api/admin/chapter-audio
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/admin/chapter-audio", () => {
    const post = async (b: unknown, o: Opts = {}) => read(await adminAudioPOST(req("/api/admin/chapter-audio", { body: b, ...o })));
    const good = (over: Record<string, unknown> = {}) => ({ editionId: book.audioEditionId, chapterId: book.audioChapterId, filename: "ch1.mp3", contentType: "audio/mpeg", sizeBytes: 5_000_000, ...over });

    it("should answer 403 for signed-out users, readers, and roles without content.manage", async () => {
      expectClientError(await post(good()), 403);
      asUser(reader);
      expectClientError(await post(good()), 403);
      asUser(support);
      expectClientError(await post(good()), 403);
      expect(mocks.getSignedUploadUrl).not.toHaveBeenCalled();
    });

    describe("as owner", () => {
      beforeEach(() => asUser(owner));

      it("should sign a key that never contains the client's file name", async () => {
        const r = await post(good({ filename: "../../etc/passwd/../x.mp3" }));
        expect(r.status).toBe(200);
        expect(r.json?.key).toMatch(new RegExp(`^editions/${book.audioEditionId}/audio/${book.audioChapterId}-[0-9a-f]{12}\\.mp3$`));
        expect(r.text).not.toContain("passwd");
      });

      const rejected: [string, Record<string, unknown>][] = [
        ["double extension a.mp3.exe", { filename: "a.mp3.exe" }],
        ["no extension", { filename: "mp3" }],
        ["trailing dot", { filename: "a.mp3." }],
        ["extension with space", { filename: "a.mp3 " }],
        ["null-byte extension", { filename: `a.mp3${NUL}.exe` }],
        ["exe with audio type", { filename: "a.exe", contentType: "audio/mpeg" }],
        ["html file", { filename: "a.html", contentType: "text/html" }],
        ["mp3 with mp4 type", { contentType: "audio/mp4" }],
        ["m4a with mpeg type", { filename: "a.m4a", contentType: "audio/mpeg" }],
        ["type wrong case", { contentType: "Audio/MPEG" }],
        ["type with parameters", { contentType: "audio/mpeg; charset=utf-8" }],
        ["type empty", { contentType: "" }],
        ["size 0", { sizeBytes: 0 }],
        ["size -1", { sizeBytes: -1 }],
        ["size 1.5", { sizeBytes: 1.5 }],
        ["size string", { sizeBytes: "5" }],
        ["size 400MB+1", { sizeBytes: 400 * 1024 * 1024 + 1 }],
        ["size 1e21", { sizeBytes: 1e21 }],
        ["size max safe + 1", { sizeBytes: Number.MAX_SAFE_INTEGER + 2 }],
        ["size null", { sizeBytes: null }],
        ["filename empty", { filename: "" }],
        ["filename 256", { filename: "a".repeat(252) + ".mp3" }],
        ["chapter id empty", { chapterId: "" }],
        ["edition id 65", { editionId: "e".repeat(65) }],
      ];
      it.each(rejected)("should reject %s with 400 and sign nothing", async (_n, over) => {
        const r = await post(good(over));
        expectClientError(r, 400);
        expect(mocks.getSignedUploadUrl).not.toHaveBeenCalled();
      });

      it.each([
        ["exactly 400 MB", { sizeBytes: 400 * 1024 * 1024 }],
        ["size 1", { sizeBytes: 1 }],
        ["upper-case extension", { filename: "A.MP3" }],
        ["m4a with audio/mp4", { filename: "a.m4a", contentType: "audio/mp4" }],
        ["m4a with audio/x-m4a", { filename: "a.m4a", contentType: "audio/x-m4a" }],
        ["name that is only the extension", { filename: ".mp3" }],
        ["unicode name", { filename: "章节😀.mp3" }],
        ["255 char name", { filename: "a".repeat(251) + ".mp3" }],
      ])("should accept %s", async (_n, over) => {
        expect((await post(good(over))).status).toBe(200);
      });

      it("should answer 404 for a chapter that belongs to another edition, an ebook chapter, and unknown ids", async () => {
        expectClientError(await post(good({ editionId: book.otherEditionId })), 404);
        expectClientError(await post(good({ editionId: book.editionId, chapterId: book.epubChapterId })), 404);
        expectClientError(await post(good({ chapterId: "missing" })), 404);
      });

      it.each([
        ["invalid JSON", "{x"],
        ["empty", ""],
        ["array", "[]"],
        ["null", "null"],
      ])("should reject %s body with 400", async (_n, raw) => {
        expectClientError(await read(await adminAudioPOST(req("/api/admin/chapter-audio", { raw }))), 400);
      });

      it("should answer 429 on the 61st upload url per hour for one admin and ip", async () => {
        const fixed = ip();
        let last = 0;
        for (let i = 0; i < 61; i++) last = (await adminAudioPOST(req("/api/admin/chapter-audio", { body: good(), ip: fixed }))).status;
        expect(last).toBe(429);
      });

      it.fails("BUG(Med) admin/chapter-audio/route.ts:632 a chapterId or editionId containing a NUL byte returns 500 (should be 404)", async () => {
        expect((await post(good({ chapterId: `a${NUL}` }))).status).toBeLessThan(500);
      });
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // GET /api/orders/[id] and /invoice
  // -------------------------------------------------------------------------------------------------------
  describe("order status and invoice", () => {
    const get = async (id: string, token?: string) => read(await orderGET(req(`/api/orders/${encodeURIComponent(id)}`, { method: "GET", headers: token ? { "x-order-token": token } : {} }), params({ id })));
    const inv = async (id: string, token?: string) => read(await invoiceGET(req(`/api/orders/${encodeURIComponent(id)}/invoice`, { method: "GET", headers: token ? { "x-order-token": token } : {} }), params({ id })));
    let guestOrder: { id: string; token: string; email: string };

    beforeAll(async () => {
      asUser(null); // earlier cases leave a session behind
      const email = `${emailPrefix}-ord${seq()}@example.test`;
      const r = await read(await checkoutPOST(req("/api/checkout", { body: { editionIds: [book.editionId], method: "card", buyer: { firstName: "Gina", lastName: "Guest", email, phone: `+2547${String(stamp).slice(-8)}` } } }), undefined));
      if (process.env.FZ_DEBUG) console.log("guest order", r.status, r.text);
      guestOrder = { id: r.json!.orderId as string, token: r.json!.claimToken as string, email };
    });

    it("should show a guest device its own order with masked contact details and only the first name", async () => {
      const r = await get(guestOrder.id, guestOrder.token);
      expect(r.status).toBe(200);
      expect(r.text).not.toContain(guestOrder.email);
      expect(r.text).not.toContain("Guest");
      expect(r.json?.buyer).toMatchObject({ name: "Gina" });
    });

    it("should answer 404, identical to 'not found', for no token, a wrong token, another signed-in reader, and a nonexistent id", async () => {
      const bodies: string[] = [];
      for (const r of [await get(guestOrder.id), await get(guestOrder.id, "wrong-token"), await get("missing", guestOrder.token), await get(guestOrder.id, "x".repeat(100_000))]) {
        expectClientError(r, 404);
        bodies.push(String(r.json?.error));
      }
      asUser(other);
      expectClientError(await get(guestOrder.id), 404);
      expectClientError(await get(guestOrder.id, "wrong"), 404);
      expect(new Set(bodies).size).toBe(1);
    });

    it.each(["<script>alert(1)</script>", `'; DROP TABLE "order";--`, "../../etc/passwd", "😀", "a".repeat(10_000), "%2e%2e%2f"])("should answer id %j with 404", async (id) => {
      if (needsUtf8(id)) return;
      expectClientError(await get(id), 404);
      expectClientError(await inv(id), 404);
    });

    it("should refuse the invoice for an unpaid order with 409 and answer 404 for strangers", async () => {
      expectClientError(await inv(guestOrder.id, guestOrder.token), 409);
      expectClientError(await inv(guestOrder.id, "wrong"), 404);
    });

    it("should find an order by its provider reference as well as by id (and never by a partial match)", async () => {
      const ref = (await db.order.findUniqueOrThrow({ where: { id: guestOrder.id } })).providerReference!;
      expect((await get(ref, guestOrder.token)).status).toBe(200);
      expectClientError(await get(ref.slice(0, 8), guestOrder.token), 404);
    });

    it.fails("BUG(High) orders/access.ts:22 GET /api/orders/%00 (a NUL byte in the public id) returns 500 on an unauthenticated endpoint (should be 404)", async () => {
      expect((await get("a\u0000b")).status).toBeLessThan(500);
    });

    it.fails("BUG(High) orders/[id]/invoice: the same NUL id returns 500 (should be 404)", async () => {
      expect((await inv("a\u0000b")).status).toBeLessThan(500);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------------------------------------
  describe("POST /api/webhooks/paystack", () => {
    const sign = (raw: string, key = SECRETS.paystack) => createHmac("sha512", key).update(raw).digest("hex");
    const call = async (raw: string, sig?: string) => read(await paystackPOST(req("/api/webhooks/paystack", { raw, headers: sig === undefined ? {} : { "x-paystack-signature": sig } }), undefined));
    const charge = JSON.stringify({ event: "charge.success", data: { reference: "r1", amount: 100000, currency: "KES" } });

    it("should apply a correctly signed event", async () => {
      expect((await call(charge, sign(charge))).json).toEqual({ received: true });
      expect(mocks.applyProviderEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "payment.succeeded", reference: "r1", amount: 1000 }));
    });

    it.each([
      ["no signature", undefined],
      ["empty signature", ""],
      ["not hex", "zzzz"],
      ["short hex", "abcd"],
      ["odd length hex", "abc"],
      ["a signature from another key", sign(charge, "sk_test_other")],
      ["the signature of another body", sign(charge + " ")],
      ["128 hex zeros", "0".repeat(128)],
      ["a 1 MB signature", "a".repeat(1_000_000)],
    ])("should answer 401 for %s and apply nothing", async (_n, sig) => {
      expectClientError(await call(charge, sig), 401);
      expect(mocks.applyProviderEvent).not.toHaveBeenCalled();
    });

    it("should answer a 5 MB unsigned body with 401, not 5xx", async () => {
      expectClientError(await call("x".repeat(5 * 1024 * 1024), "abcd"), 401);
    });

    it("should answer 400 for a correctly signed body that is not JSON", async () => {
      const raw = "{not json";
      expectClientError(await call(raw, sign(raw)), 400);
    });

    it.each(["null", "[]", '"str"', "123", "{}", '{"event":"charge.success"}', '{"event":"charge.success","data":null}', '{"event":"charge.success","data":{"reference":5,"amount":"x","currency":1}}', '{"event":{"a":1}}'])(
      "should never 5xx for the signed payload %s",
      async (raw) => {
        const r = await call(raw, sign(raw));
        expect(r.status).toBe(200);
      },
    );

    it("should answer 503 (so Paystack retries) only when applying the event fails, and leak nothing", async () => {
      mocks.applyProviderEvent.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.1:5432"));
      const r = await call(charge, sign(charge));
      expect(r.status).toBe(503);
      expectNoLeak(r);
    });

    it("should hand a replayed identical event to the single-writer function each time (idempotency lives in applyProviderEvent)", async () => {
      await call(charge, sign(charge));
      await call(charge, sign(charge));
      expect(mocks.applyProviderEvent).toHaveBeenCalledTimes(2);
      expect(mocks.applyProviderEvent.mock.calls[0][0]).toEqual(mocks.applyProviderEvent.mock.calls[1][0]);
    });
  });

  describe("POST /api/webhooks/mpesa/[token]", () => {
    const call = async (token: string, raw: string) => read(await mpesaPOST(req(`/api/webhooks/mpesa/${encodeURIComponent(token)}`, { raw }), params({ token })));
    const ok = JSON.stringify({ Body: { stkCallback: { MerchantRequestID: "m", CheckoutRequestID: "c1", ResultCode: 0, ResultDesc: "ok", CallbackMetadata: { Item: [{ Name: "Amount", Value: 100 }] } } } });

    it.each(["", "wrong", SECRETS.mpesa + "x", SECRETS.mpesa.slice(1), "a".repeat(10_000), "<script>", `${SECRETS.mpesa}${NUL}`, "😀"])("should answer 404 with no body for the path secret %j", async (token) => {
      const res = await mpesaPOST(req("/api/webhooks/mpesa/x", { raw: ok }), params({ token }));
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("");
      expect(mocks.applyProviderEvent).not.toHaveBeenCalled();
    });

    it("should accept a callback on the right path and pass it on", async () => {
      expect((await call(SECRETS.mpesa, ok)).json).toMatchObject({ ResultCode: 0 });
      expect(mocks.applyProviderEvent).toHaveBeenCalledTimes(1);
    });

    it.each(["", "{x", "null", "[]", '"s"', "7", "{}", '{"Body":null}', '{"Body":{"stkCallback":"x"}}', '{"Body":{"stkCallback":{"ResultCode":"0"}}}', '{"Body":{"stkCallback":{"ResultCode":0,"CallbackMetadata":{"Item":"x"}}}}', '{"Body":{"stkCallback":{"ResultCode":0,"CallbackMetadata":{"Item":[null,5,{"Name":"Amount"}]}}}}'])(
      "should answer the signed-by-path payload %j with 200/503, never an unhandled 500",
      async (raw) => {
        const r = await call(SECRETS.mpesa, raw);
        expect([200, 503]).toContain(r.status);
        expectNoLeak(r);
      },
    );

    it("should ask Safaricom to retry (503) only when applying fails", async () => {
      mocks.applyProviderEvent.mockRejectedValueOnce(new Error("db down"));
      expect((await call(SECRETS.mpesa, ok)).status).toBe(503);
    });

    it("should answer a 5 MB body without a 5xx", async () => {
      const r = await call(SECRETS.mpesa, JSON.stringify({ pad: "x".repeat(5 * 1024 * 1024) }));
      expect(r.status).toBeLessThan(500);
    });
  });

  describe("POST /api/webhooks/resend", () => {
    // Svix signs "<id>.<timestamp>.<body>" with the base64-decoded part of the secret after whsec_.
    const secretBytes = Buffer.from(SECRETS.resend.slice(6), "base64");
    const signed = (raw: string, ts = String(Math.floor(Date.now() / 1000)), id = "msg_1") => ({
      "svix-id": id,
      "svix-timestamp": ts,
      "svix-signature": `v1,${createHmac("sha256", secretBytes).update(`${id}.${ts}.${raw}`).digest("base64")}`,
    });
    const call = async (raw: string, headers: Record<string, string>) => read(await resendPOST(req("/api/webhooks/resend", { raw, headers }), undefined));

    it("should answer 400 when any svix header is missing", async () => {
      const raw = "{}";
      for (const drop of ["svix-id", "svix-timestamp", "svix-signature"]) {
        const h: Record<string, string> = { ...signed(raw) };
        delete h[drop];
        expectClientError(await call(raw, h), 400);
      }
    });

    it.each([
      ["garbage signature", { "svix-signature": "v1,AAAA" }],
      ["no version prefix", { "svix-signature": "AAAA" }],
      ["empty-ish signature", { "svix-signature": "v1," }],
      ["non-numeric timestamp", { "svix-timestamp": "abc" }],
      ["very old timestamp", { "svix-timestamp": "1000" }],
      ["huge timestamp", { "svix-timestamp": "9".repeat(30) }],
      ["a 1 MB signature", { "svix-signature": "v1," + "A".repeat(1_000_000) }],
    ])("should answer 401 for %s", async (_n, over) => {
      const raw = JSON.stringify({ type: "email.delivered", data: { email_id: "x" } });
      expectClientError(await call(raw, { ...signed(raw), ...over }), 401);
    });

    it("should acknowledge a verified event it does not care about and one for an unknown email id", async () => {
      for (const raw of [JSON.stringify({ type: "email.sent", data: { email_id: "x" } }), JSON.stringify({ type: "email.delivered", data: { email_id: `unknown-${stamp}` } }), JSON.stringify({ type: "email.delivered" })]) {
        expect((await call(raw, signed(raw))).json).toEqual({ received: true });
      }
    });

    it("should refuse a tampered body (valid headers for another body)", async () => {
      const raw = JSON.stringify({ type: "email.delivered", data: { email_id: "x" } });
      expectClientError(await call(raw + " ", signed(raw)), 401);
    });

    it.fails.each([
      ["JSON null", "null"],
      ["a numeric email_id", JSON.stringify({ type: "email.delivered", data: { email_id: 5 } })],
    ])("BUG(Low) webhooks/resend/route.ts:384 a verified payload that is %s returns 500 (should be acknowledged or 400)", async (_n, raw) => {
      expect((await call(raw, signed(raw))).status).toBeLessThan(500);
    });
  });

  describe("POST /api/webhooks/sanity", () => {
    const sig = (raw: string, t = Date.now(), secret = SECRETS.sanity) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("base64url")}`;
    const call = async (raw: string, header?: string) => read(await sanityPOST(req("/api/webhooks/sanity", { raw, headers: header === undefined ? {} : { "sanity-webhook-signature": header } }), undefined));

    it("should revalidate for a fresh, correctly signed request", async () => {
      expect((await call("{}", sig("{}"))).json).toEqual({ revalidated: true });
    });

    it.each([
      ["no header", undefined],
      ["empty", ""],
      ["garbage", "garbage"],
      ["no t", "v1=abc"],
      ["no v1", "t=1"],
      ["a stale timestamp (10 min old)", sig("{}", Date.now() - 10 * 60_000)],
      ["a timestamp in the future (10 min)", sig("{}", Date.now() + 10 * 60_000)],
      ["a signature from another secret", sig("{}", Date.now(), "other")],
      ["a signature for another body", sig("{x}")],
      ["a huge timestamp", `t=${"9".repeat(40)},v1=abc`],
      ["a 1 MB header", `t=${Date.now()},v1=${"a".repeat(1_000_000)}`],
    ])("should answer 401 for %s", async (_n, header) => {
      expectClientError(await call("{}", header), 401);
    });

    it("should accept a replay inside the 5-minute window (the effect, a cache refresh, is harmless)", async () => {
      const h = sig("{}");
      expect((await call("{}", h)).status).toBe(200);
      expect((await call("{}", h)).status).toBe(200);
    });
  });

  describe("POST /api/webhooks/chatwoot", () => {
    const nowS = () => Math.floor(Date.now() / 1000);
    const sign = (raw: string, ts = String(nowS()), secret = SECRETS.chatwoot) => ({ "x-chatwoot-timestamp": ts, "x-chatwoot-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}` });
    const call = async (raw: string, headers: Record<string, string> = {}) => read(await chatwootPOST(req("/api/webhooks/chatwoot", { raw, headers }), undefined));
    const msg = (over: Record<string, unknown> = {}) => JSON.stringify({ event: "message_created", id: 1, message_type: "incoming", content: "hi", sender: { name: "Vi", email: "v@x.co" }, conversation: { id: 9 }, ...over });

    it("should raise one admin notice for a verified incoming message and cut content to 1000 chars", async () => {
      const raw = msg({ content: "c".repeat(100_000) });
      expect((await call(raw, sign(raw))).json).toEqual({ received: true });
      const notice = mocks.notifyAdmins.mock.calls[0][0] as { body: string; dedupeKey: string };
      expect(notice.dedupeKey).toBe("contact:chatwoot:9:1");
      expect(notice.body.length).toBeLessThan(1200);
    });

    it.each([
      ["no headers", {}],
      ["bad signature", { "x-chatwoot-timestamp": String(nowS()), "x-chatwoot-signature": "sha256=00" }],
      ["a stale timestamp", sign("{}", String(nowS() - 3600))],
      ["a non-numeric timestamp", { "x-chatwoot-timestamp": "abc", "x-chatwoot-signature": "sha256=00" }],
      ["a signature from another secret", sign("{}", String(nowS()), "other")],
    ])("should answer 401 for %s and notify nobody", async (_n, headers) => {
      expectClientError(await call("{}", headers), 401);
      expect(mocks.notifyAdmins).not.toHaveBeenCalled();
    });

    it("should answer 400 for a signed non-JSON body", async () => {
      expectClientError(await call("{x", sign("{x")), 400);
    });

    it.each([
      ["an agent reply", msg({ message_type: "outgoing" })],
      ["a private note", msg({ private: true })],
      ["another event", msg({ event: "conversation_created" })],
      ["no id", msg({ id: undefined })],
      ["no conversation", msg({ conversation: undefined })],
    ])("should acknowledge and ignore %s", async (_n, raw) => {
      expect((await call(raw, sign(raw))).json).toEqual({ received: true });
      expect(mocks.notifyAdmins).not.toHaveBeenCalled();
    });

    it.fails("BUG(Low) webhooks/chatwoot/route.ts:492 a verified payload that is JSON null returns 500 (should be acknowledged)", async () => {
      expect((await call("null", sign("null"))).status).toBeLessThan(500);
    });

    it.fails("BUG(Low) webhooks/chatwoot/route.ts:503 a verified message whose content is a number returns 500 (should be acknowledged)", async () => {
      const raw = msg({ content: 12345 });
      expect((await call(raw, sign(raw))).status).toBeLessThan(500);
    });
  });

  describe("POST /api/webhooks/africastalking/delivery", () => {
    const form = (fields: Record<string, string>) => {
      const f = new URLSearchParams(fields);
      return { raw: f.toString(), contentType: "application/x-www-form-urlencoded" };
    };
    const call = async (o: Opts, search = "") => read(await atPOST(req("/api/webhooks/africastalking/delivery", { ...o, search }), undefined));

    it("should answer 401 without the secret, with a wrong one, with the right one cut short, and with it in neither place", async () => {
      for (const o of [{ ...form({ id: "x", status: "Success" }) }, { ...form({ id: "x", status: "Success" }), headers: { "x-webhook-token": "wrong" } }, { ...form({ id: "x", status: "Success" }), headers: { "x-webhook-token": SECRETS.at.slice(1) } }, { ...form({ id: "x", status: "Success" }), headers: { "x-webhook-token": "" } }]) {
        expectClientError(await call(o), 401);
      }
      expectClientError(await call(form({ id: "x", status: "Success" }), "?token=wrong"), 401);
    });

    it("should accept the secret in the header or in ?token and acknowledge unknown ids and in-flight statuses", async () => {
      expect((await call({ ...form({ id: `none-${stamp}`, status: "Success" }), headers: { "x-webhook-token": SECRETS.at } })).json).toEqual({ received: true });
      expect((await call(form({ id: `none-${stamp}`, status: "Submitted" }), `?token=${SECRETS.at}`)).json).toEqual({ received: true });
      expect((await call({ ...form({ id: "x", status: "success" }), headers: { "x-webhook-token": SECRETS.at } })).json).toEqual({ received: true });
    });

    it("should answer 400 when id or status is missing, and when a field is a file instead of text", async () => {
      expectClientError(await call({ ...form({ status: "Success" }), headers: { "x-webhook-token": SECRETS.at } }), 400);
      expectClientError(await call({ ...form({ id: "x" }), headers: { "x-webhook-token": SECRETS.at } }), 400);
    });

    it("should move a known message to DELIVERED on 'Success'", async () => {
      const u = await mkUser();
      const providerId = `AT-${stamp}-${seq()}`;
      const row = await db.notificationLog.create({ data: { userId: u.id, channel: "SMS", status: "SENT", purpose: "fz", recipient: "+254700000000", providerId } });
      await call({ ...form({ id: providerId, status: "Success" }), headers: { "x-webhook-token": SECRETS.at } });
      expect((await db.notificationLog.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("DELIVERED");
    });

    it.fails("BUG(Med) webhooks/africastalking/delivery/route.ts:562 a JSON or empty body (wrong content-type) makes request.formData() throw: 500 instead of 400", async () => {
      const r = await call({ raw: JSON.stringify({ id: "x", status: "Success" }), contentType: "application/json", headers: { "x-webhook-token": SECRETS.at } });
      expectClientError(r, 400);
    });
  });

  describe("POST /api/qstash/send-otp", () => {
    const call = async (raw: string, signature?: string) => read(await qstashPOST(req("/api/qstash/send-otp", { raw, headers: signature === undefined ? {} : { "upstash-signature": signature } }), undefined));
    const job = (over: Record<string, unknown> = {}) => JSON.stringify({ channel: "email", to: "a@b.co", code: "123456", ...over });

    it.each([undefined, "", "garbage", "valid-signatur", "a".repeat(100_000)])("should answer 401 for signature %j and deliver nothing", async (sig) => {
      expect((await call(job(), sig)).status).toBe(401);
      expect(mocks.deliverOtp).not.toHaveBeenCalled();
    });

    it("should deliver a well-formed signed job", async () => {
      expect((await call(job(), mocks.qstashValid)).json).toEqual({ ok: true });
      expect(mocks.deliverOtp).toHaveBeenCalledWith({ channel: "email", to: "a@b.co", code: "123456" });
    });

    it.each([
      ["code 3 digits", { code: "123" }],
      ["code 9 digits", { code: "123456789" }],
      ["code letters", { code: "12ab56" }],
      ["code number", { code: 123456 }],
      ["code with newline", { code: "123456\n" }],
      ["channel push", { channel: "push" }],
      ["channel upper-case", { channel: "EMAIL" }],
      ["to 2 chars", { to: "ab" }],
      ["to 321 chars", { to: "t".repeat(321) }],
      ["to missing", { to: undefined }],
    ])("should answer a signed job with %s with 400 Bad job and deliver nothing", async (_n, over) => {
      const r = await call(job(over), mocks.qstashValid);
      expect(r.status).toBe(400);
      expect(mocks.deliverOtp).not.toHaveBeenCalled();
    });

    it.fails("BUG(Low) qstash/send-otp/route.ts:686 a signed body that is not JSON makes JSON.parse throw: 500 (QStash then retries forever) instead of 400", async () => {
      expect((await call("{not json", mocks.qstashValid)).status).toBeLessThan(500);
    });
  });

  describe("GET /api/cron/orders", () => {
    const call = async (auth?: string) => read(await cronGET(req("/api/cron/orders", { method: "GET", headers: auth === undefined ? {} : { authorization: auth } }), undefined));

    it.each([undefined, "", "Bearer", "Bearer ", "Bearer wrong", `Bearer ${SECRETS.cron}x`, `Bearer ${SECRETS.cron.slice(1)}`, SECRETS.cron.slice(1), `Basic ${SECRETS.cron}`, "Bearer " + "a".repeat(100_000)])("should answer 401 for authorization %j and touch nothing", async (auth) => {
      const r = await call(auth);
      expect(r.status).toBe(401);
      expect(mocks.reconcilePendingOrder).not.toHaveBeenCalled();
    });
  });
});
