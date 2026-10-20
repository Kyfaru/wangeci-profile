/**
 * INPUT FUZZ SUITE, part 3 of 3: admin server actions (FormData in, ActionResult out), the admin writers in
 * lib/admin, the cart and settings server actions. Inventory: header of schemas.test.ts.
 * Needs the throwaway local database (TEST_DATABASE_URL). Every rejected case also asserts that nothing was
 * written (row counts and audit-log count unchanged). Known defects are pinned with `it.fails("BUG(...)")`.
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string; twoFactorEnabled: boolean; phoneNumber: string | null; name: string },
  fresh: true,
  headObject: vi.fn(async (_b: string, _k: string): Promise<null | { contentType?: string; sizeBytes: number }> => null),
  deleteObject: vi.fn(async () => {}),
  refund: vi.fn(async () => ({ ok: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", R2_BUCKET_PROTECTED: "prot", CHECKOUT_FEE_PERCENT: 0 } }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});
vi.mock("@/lib/server/session", async () => {
  const { can } = await import("@/lib/permissions");
  const session = () => (mocks.user ? { user: mocks.user, session: { id: "s1", createdAt: new Date() } } : null);
  return {
    getSession: async () => session(),
    checkAdmin: async (action: Parameters<typeof can>[1]) => {
      if (!mocks.user) return { ok: false, reason: "signed-out" };
      if (!can(mocks.user.role, action)) return { ok: false, reason: "forbidden" };
      return { ok: true, user: mocks.user };
    },
  };
});
vi.mock("@/lib/auth/guards", () => ({ hasFreshStepUp: async () => mocks.fresh, STEP_UP_ADMIN_MS: 600_000 }));
vi.mock("@/lib/r2", () => ({ headObject: mocks.headObject, deleteObject: mocks.deleteObject, getSignedUploadUrl: vi.fn(), getSignedDownloadUrl: vi.fn(), publicUrl: (k: string) => k }));
vi.mock("@/lib/payments", () => ({ getProvider: () => ({ refund: mocks.refund }) }));
vi.mock("@/lib/server/notifier", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/lib/server/notify-admins", () => ({ notifyAdmins: vi.fn(async () => {}) }));

import * as actions from "@/app/admin/actions";
import { mergeCart, removeFromCart } from "@/app/actions/cart";
import { updatePreferences } from "@/app/actions/settings";
import { AdminError, reasonOrThrow, reasonSchema } from "@/lib/admin/actions";
import { createBook } from "@/lib/admin/content";

const NUL = "\u0000";
const GOOD_REASON = "Because the owner asked for it";

const form = (fields: Record<string, string | undefined>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) f.set(k, v);
  return f;
};

describe("reason rules (pure)", () => {
  it.each([
    ["empty", "", false],
    ["whitespace", "          ", false],
    ["9 chars", "123456789", false],
    ["9 chars padded to 10", " 123456789 ", false],
    ["10 chars", "1234567890", true],
    ["500 chars", "r".repeat(500), true],
    ["501 chars", "r".repeat(501), false],
    ["10x max", "r".repeat(5000), false],
    ["emoji x10", "😀".repeat(10), true],
    ["html", "<script>alert(1)</script>", true],
    ["sql", `'; DROP TABLE "user";--`, true],
    ["newlines", "line one\nline two", true],
  ])("should handle a %s reason", (_n, reason, ok) => {
    expect(reasonSchema.safeParse(reason).success).toBe(ok);
    if (ok) expect(reasonOrThrow(reason)).toBe(reason.trim());
    else expect(() => reasonOrThrow(reason)).toThrow(AdminError);
  });

  it("should tell the person what is wrong with a short reason in plain words", () => {
    expect(() => reasonOrThrow("short")).toThrow("Please write a reason of at least 10 characters.");
  });

  it("should name the 500 limit when a reason is too long", () => {
    expect(() => reasonOrThrow("r".repeat(501))).toThrow(/500/);
  });
});

describe.skipIf(!url)("admin and cart actions (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const stamp = Date.now();
  const prefix = `fza-${stamp}`;
  let n = 0;
  const seq = () => ++n;
  const userIds: string[] = [];
  let owner: Awaited<ReturnType<typeof mkUser>>;
  let support: Awaited<ReturnType<typeof mkUser>>;
  let reader: Awaited<ReturnType<typeof mkUser>>;
  let victim: Awaited<ReturnType<typeof mkUser>>;
  const asUser = (u: { id: string; email: string; role: string; phoneNumber: string | null; name: string } | null) => {
    mocks.user = u && { ...u, twoFactorEnabled: true };
  };

  async function mkUser(role = "reader") {
    const u = await db.user.create({ data: { name: "Fuzz Admin Test", email: `${prefix}-u${seq()}@example.test`, role } });
    userIds.push(u.id);
    return u;
  }
  const actor = () => ({ id: owner.id, ip: "203.0.113.9" });
  async function draft(format: "EPUB" | "AUDIOBOOK" = "EPUB") {
    return createBook({ actor: actor(), title: `Fuzz ${seq()}`, slug: `${prefix}-b${seq()}`, author: "Author", format, price: 100, currency: "KES", narrator: format === "AUDIOBOOK" ? "N" : undefined });
  }
  async function counts() {
    return {
      audit: await db.auditLog.count({ where: { adminId: owner.id } }),
      coupons: await db.coupon.count({ where: { code: { startsWith: "FZA" + stamp } } }),
      works: await db.work.count({ where: { slug: { startsWith: prefix } } }),
      editions: await db.edition.count({ where: { work: { slug: { startsWith: prefix } } } }),
      chapters: await db.chapter.count({ where: { edition: { work: { slug: { startsWith: prefix } } } } }),
      users: await db.user.count({ where: { id: { in: userIds }, banned: true } }),
      roles: (await db.user.findMany({ where: { id: { in: userIds } }, select: { role: true }, orderBy: { id: "asc" } })).map((u) => u.role).join(","),
      entitlements: await db.entitlement.count({ where: { userId: { in: userIds } } }),
      comments: await db.comment.count({ where: { userId: { in: userIds } } }),
    };
  }

  beforeAll(async () => {
    owner = await mkUser("owner");
    support = await mkUser("support");
    reader = await mkUser("reader");
    victim = await mkUser("reader");
  });

  beforeEach(() => {
    asUser(owner);
    mocks.fresh = true;
    mocks.headObject.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    if (!process.env.FZ_DEBUG) vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(async () => {
    const works = await db.work.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } });
    const eds = await db.edition.findMany({ where: { workId: { in: works.map((w) => w.id) } }, select: { id: true } });
    await db.bookmark.deleteMany({ where: { editionId: { in: eds.map((e) => e.id) } } });
    await db.readingPosition.deleteMany({ where: { editionId: { in: eds.map((e) => e.id) } } });
    await db.entitlement.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { editionId: { in: eds.map((e) => e.id) } }] } });
    await db.comment.deleteMany({ where: { userId: { in: userIds } } });
    await db.feedback.deleteMany({ where: { userId: { in: userIds } } });
    await db.userPreferences.deleteMany({ where: { userId: { in: userIds } } });
    await db.cart.deleteMany({ where: { userId: { in: userIds } } });
    await db.coupon.deleteMany({ where: { code: { startsWith: "FZA" + stamp } } });
    await db.auditLog.deleteMany({ where: { adminId: { in: userIds } } });
    await db.work.deleteMany({ where: { id: { in: works.map((w) => w.id) } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  // -------------------------------------------------------------------------------------------------------
  describe("the gate on every admin action", () => {
    const every: [string, (f: FormData) => Promise<actions.ActionResult>][] = [
      ["createCouponAction", (f) => actions.createCouponAction(null, f)],
      ["setCouponActiveAction", (f) => actions.setCouponActiveAction(null, f)],
      ["refundOrderAction", (f) => actions.refundOrderAction(null, f)],
      ["manualRefundAction", (f) => actions.manualRefundAction(null, f)],
      ["grantAccessAction", (f) => actions.grantAccessAction(null, f)],
      ["revokeAccessAction", (f) => actions.revokeAccessAction(null, f)],
      ["banAction", (f) => actions.banAction(null, f)],
      ["roleAction", (f) => actions.roleAction(null, f)],
      ["editionActiveAction", (f) => actions.editionActiveAction(null, f)],
      ["moderateCommentAction", (f) => actions.moderateCommentAction(null, f)],
      ["replyToCommentAction", (f) => actions.replyToCommentAction(null, f)],
      ["feedbackStatusAction", (f) => actions.feedbackStatusAction(null, f)],
      ["createBookAction", (f) => actions.createBookAction(null, f)],
      ["saveChapterAction", (f) => actions.saveChapterAction(null, f)],
      ["moveChapterAction", (f) => actions.moveChapterAction(null, f)],
      ["deleteChapterAction", (f) => actions.deleteChapterAction(null, f)],
      ["attachChapterAudioAction", (f) => actions.attachChapterAudioAction(null, f)],
      ["importManuscriptAction", (f) => actions.importManuscriptAction(null, f)],
    ];

    it.each(every)("should refuse %s for a signed-out visitor and a plain reader, and change nothing", async (_n, run) => {
      const before = await counts();
      for (const u of [null, reader]) {
        asUser(u);
        const r = await run(form({ reason: GOOD_REASON, title: "T", slug: `${prefix}-gate`, author: "A", format: "EPUB", price: "10", code: "GATE123", type: "PERCENT", value: "5" }));
        expect(r).toEqual({ ok: false, message: "You are not allowed to do that." });
      }
      expect(await counts()).toEqual(before);
    });

    it("should refuse content and coupon actions for the support role (which lacks those permissions)", async () => {
      asUser(support);
      const before = await counts();
      expect((await actions.createBookAction(null, form({ title: "T", slug: `${prefix}-sup`, author: "A", format: "EPUB", price: "10" }))).ok).toBe(false);
      expect((await actions.createCouponAction(null, form({ code: "SUP12345", type: "PERCENT", value: "5", reason: GOOD_REASON }))).ok).toBe(false);
      expect(await counts()).toEqual(before);
    });

    it("should ask for a fresh email code before a refund or a role change, and do nothing without it", async () => {
      mocks.fresh = false;
      const before = await counts();
      const refund = await actions.refundOrderAction(null, form({ orderId: "x", reason: GOOD_REASON }));
      const role = await actions.roleAction(null, form({ userId: victim.id, role: "support", reason: GOOD_REASON }));
      expect(refund).toMatchObject({ ok: false, stepUp: true });
      expect(role).toMatchObject({ ok: false, stepUp: true });
      expect(await counts()).toEqual(before);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("createCouponAction", () => {
    const code = () => `FZA${stamp}-${seq()}`;
    const make = (over: Record<string, string | undefined> = {}) => actions.createCouponAction(null, form({ code: code(), type: "PERCENT", value: "10", reason: GOOD_REASON, ...over }));

    it("should create a coupon, upper-case its code and store the value to two decimals", async () => {
      const c = `fza${stamp}-low${seq()}`;
      expect((await make({ code: c })).ok).toBe(true);
      const row = await db.coupon.findUniqueOrThrow({ where: { code: c.toUpperCase() } });
      expect(Number(row.value)).toBe(10);
    });

    const rejected: [string, Record<string, string | undefined>][] = [
      ["reason 9 chars", { reason: "123456789" }],
      ["reason missing", { reason: undefined }],
      ["reason 501 chars", { reason: "r".repeat(501) }],
      ["code 2 chars", { code: "AB" }],
      ["code 31 chars", { code: "A".repeat(31) }],
      ["code with a space", { code: "AB CD" }],
      ["code with unicode", { code: "ÄB-CD" }],
      ["code with emoji", { code: "AB😀CD" }],
      ["code with html", { code: "<script>" }],
      ["code with sql", { code: `A';DROP--` }],
      ["code with traversal", { code: "../../etc" }],
      ["code with newline", { code: "AB\nCD" }],
      ["code with NUL", { code: `AB${NUL}CD` }],
      ["code empty", { code: "" }],
      ["value empty", { value: "" }],
      ["value 0", { value: "0" }],
      ["value -1", { value: "-1" }],
      ["value NaN text", { value: "abc" }],
      ["percent 100.01", { value: "100.01" }],
      ["percent 101", { value: "101" }],
    ];
    it.each(rejected)("should refuse %s and write nothing", async (_n, over) => {
      const before = await counts();
      const r = await make(over);
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates/i);
      expect(await counts()).toEqual(before);
    });

    it.each([
      ["percent exactly 100", { value: "100" }, 100],
      ["percent 0.5", { value: "0.5" }, 0.5],
      ["fixed 1e3", { type: "FIXED", value: "1e3" }, 1000],
      ["fixed padded", { type: "FIXED", value: "  250  " }, 250],
      ["fixed 99999999.99", { type: "FIXED", value: "99999999.99" }, 99999999.99],
      ["unknown type falls back to PERCENT", { type: "free", value: "5" }, 5],
    ])("should accept %s", async (_n, over, stored) => {
      const c = code();
      expect((await make({ ...over, code: c })).ok).toBe(true);
      expect(Number((await db.coupon.findUniqueOrThrow({ where: { code: c } })).value)).toBe(stored);
    });

    it("should refuse a duplicate code, in any case", async () => {
      const c = code();
      expect((await make({ code: c })).ok).toBe(true);
      const before = await counts();
      expect((await make({ code: c.toLowerCase() })).message).toBe("That code already exists.");
      expect(await counts()).toEqual(before);
    });

    it.each([
      ["fixed Infinity", { type: "FIXED", value: "Infinity" }],
      ["fixed 1e21", { type: "FIXED", value: "1e21" }],
      ["fixed 1e9 (over the column size)", { type: "FIXED", value: "1000000000" }],
      ["endsAt text", { endsAt: "tomorrow" }],
      ["endsAt 2026-13-45", { endsAt: "2026-13-45" }],
    ])("should fail safely (ok:false, generic text, no row) for %s", async (_n, over) => {
      const before = await counts();
      const r = await make(over as Record<string, string>);
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates/i);
      expect(await counts()).toEqual(before);
    });

    it.fails("BUG(Med) lib/admin/actions.ts:185,189 a percentage below 0.005 (e.g. 0.001) passes the 'more than zero' check and is stored as 0.00: a coupon that does nothing", async () => {
      const c = code();
      await make({ code: c, value: "0.001" });
      const row = await db.coupon.findUnique({ where: { code: c } });
      expect(row === null || Number(row.value) > 0).toBe(true);
    });

    it.fails("BUG(Low) lib/admin/actions.ts:185 Infinity, 1e21 and over-size fixed values pass validation and fail in the database: the owner sees 'Something went wrong' instead of a field message", async () => {
      const r = await make({ type: "FIXED", value: "1e21" });
      expect(r.message).not.toMatch(/Something went wrong/);
    });

    it.fails("BUG(Med) app/admin/actions.ts:67,78 minSubtotal text such as 'abc' becomes NaN and is stored as a NaN minimum: the coupon is created and its minimum is silently ignored", async () => {
      const c = code();
      await make({ code: c, minSubtotal: "abc" });
      expect(await db.coupon.count({ where: { code: c } })).toBe(0);
    });

    it.fails("BUG(Low) app/admin/actions.ts:79 maxRedemptions 1.5 is accepted (Prisma rounds it) instead of being refused as not a whole number", async () => {
      expect((await make({ maxRedemptions: "1.5" })).ok).toBe(false);
    });

    it.fails("BUG(Low) app/admin/actions.ts:80 the date 2026-02-30 is accepted (JavaScript rolls it into March) instead of being refused as not a real date", async () => {
      expect((await make({ endsAt: "2026-02-30" })).ok).toBe(false);
    });

    it.fails("BUG(Low) lib/admin/actions.ts:181 negative minSubtotal, zero or negative maxRedemptions (an unusable coupon) and a past end date are accepted", async () => {
      expect((await make({ minSubtotal: "-5" })).ok).toBe(false);
      expect((await make({ maxRedemptions: "0" })).ok).toBe(false);
      expect((await make({ maxRedemptions: "-3" })).ok).toBe(false);
      expect((await make({ endsAt: "2001-01-01" })).ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("reasons on the other writers", () => {
    it.each([
      ["9", "123456789", false],
      ["10", "1234567890", true],
      ["500", "r".repeat(500), true],
      ["501", "r".repeat(501), false],
    ])("should enforce a %s char reason on setCouponActiveAction", async (_n, reason, ok) => {
      const code = `FZA${stamp}-ACT${seq()}`;
      await actions.createCouponAction(null, form({ code, type: "PERCENT", value: "5", reason: GOOD_REASON }));
      const row = await db.coupon.findUniqueOrThrow({ where: { code } });
      const before = await counts();
      const r = await actions.setCouponActiveAction(null, form({ couponId: row.id, active: "false", reason }));
      expect(r.ok).toBe(ok);
      expect((await db.coupon.findUniqueOrThrow({ where: { id: row.id } })).isActive).toBe(!ok);
      if (!ok) expect(await counts()).toEqual(before);
    });

    it("should answer unknown ids with a plain message and change nothing", async () => {
      const before = await counts();
      const calls = [
        actions.setCouponActiveAction(null, form({ couponId: "nope", active: "true", reason: GOOD_REASON })),
        actions.revokeAccessAction(null, form({ entitlementId: "nope", reason: GOOD_REASON })),
        actions.grantAccessAction(null, form({ userId: "nope", editionId: "nope", reason: GOOD_REASON })),
        actions.moderateCommentAction(null, form({ commentId: "nope", status: "APPROVED", reason: GOOD_REASON })),
        actions.replyToCommentAction(null, form({ commentId: "nope", body: "hello" })),
        actions.feedbackStatusAction(null, form({ feedbackId: "nope", status: "READ" })),
        actions.editionActiveAction(null, form({ editionId: "nope", active: "true", reason: GOOD_REASON })),
        actions.refundOrderAction(null, form({ orderId: "nope", reason: GOOD_REASON })),
        actions.manualRefundAction(null, form({ orderId: "nope", reason: GOOD_REASON, reference: "REF-1234" })),
      ];
      for (const r of await Promise.all(calls)) {
        expect(r.ok).toBe(false);
        expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates|Something went wrong/i);
      }
      expect(await counts()).toEqual(before);
    });

    it.each(["", `a${NUL}b`, "😀", "<script>", "x".repeat(10_000)])("should fail safely for the id %j (never a thrown error)", async (id) => {
      const r = await actions.banAction(null, form({ userId: id, banned: "true", reason: GOOD_REASON }));
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates/i);
    });

    it("should refuse banning yourself, an admin, and changing your own or the owner's role", async () => {
      const before = await counts();
      expect((await actions.banAction(null, form({ userId: owner.id, banned: "true", reason: GOOD_REASON }))).message).toBe("You cannot ban yourself.");
      expect((await actions.banAction(null, form({ userId: support.id, banned: "true", reason: GOOD_REASON }))).ok).toBe(false);
      expect((await actions.roleAction(null, form({ userId: owner.id, role: "reader", reason: GOOD_REASON }))).message).toBe("You cannot change your own role.");
      expect(await counts()).toEqual(before);
    });

    it.each(["owner", "OWNER", "admin", "Support", "", "reader "])("should refuse the role %j and leave the roles unchanged", async (role) => {
      const before = await counts();
      const r = await actions.roleAction(null, form({ userId: victim.id, role, reason: GOOD_REASON }));
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT/i);
      expect(await counts()).toEqual(before);
    });

    it.each(["approved", "PENDING", "", "SPAM "])("should refuse the comment status %j", async (status) => {
      const before = await counts();
      expect((await actions.moderateCommentAction(null, form({ commentId: "x", status, reason: GOOD_REASON }))).ok).toBe(false);
      expect(await counts()).toEqual(before);
    });

    it.each([
      ["empty", ""],
      ["whitespace", "   "],
      ["1001", "b".repeat(1001)],
    ])("should refuse a %s reply", async (_n, body) => {
      const c = await db.comment.create({ data: { userId: reader.id, postSlug: "fz", body: "parent comment", status: "APPROVED" } });
      const before = await counts();
      expect((await actions.replyToCommentAction(null, form({ commentId: c.id, body }))).ok).toBe(false);
      expect(await counts()).toEqual(before);
    });

    it("should keep a reply's html as plain text and attach a reply-to-a-reply to the top-level comment", async () => {
      const top = await db.comment.create({ data: { userId: reader.id, postSlug: "fz", body: "top", status: "APPROVED" } });
      const html = '<script>alert(1)</script> "><img src=x onerror=1>';
      expect((await actions.replyToCommentAction(null, form({ commentId: top.id, body: html }))).ok).toBe(true);
      const reply = await db.comment.findFirstOrThrow({ where: { parentId: top.id } });
      expect(reply.body).toBe(html);
      expect((await actions.replyToCommentAction(null, form({ commentId: reply.id, body: "nested" }))).ok).toBe(true);
      expect(await db.comment.count({ where: { parentId: top.id } })).toBe(2);
    });

    it.each([
      ["reference 3 chars", "abc"],
      ["reference 81 chars", "r".repeat(81)],
      ["reference whitespace", "      "],
    ])("should refuse a manual refund with %s before touching any order", async (_n, reference) => {
      const before = await counts();
      const r = await actions.manualRefundAction(null, form({ orderId: "x", reason: GOOD_REASON, reference }));
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/reference|characters/i);
      expect(await counts()).toEqual(before);
    });

    it("should refuse complimentary access for an unknown edition, and for the same grant twice", async () => {
      const d = await draft();
      const before = await counts();
      expect((await actions.grantAccessAction(null, form({ userId: victim.id, editionId: "nope", reason: GOOD_REASON }))).ok).toBe(false);
      expect((await actions.grantAccessAction(null, form({ userId: victim.id, editionId: d.editionId, reason: GOOD_REASON }))).ok).toBe(true);
      expect((await actions.grantAccessAction(null, form({ userId: victim.id, editionId: d.editionId, reason: GOOD_REASON }))).message).toBe("This customer already has access to that edition.");
      expect((await counts()).entitlements).toBe(before.entitlements + 1);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("createBookAction", () => {
    const slug = () => `${prefix}-s${seq()}`;
    const make = (over: Record<string, string | undefined> = {}) => actions.createBookAction(null, form({ title: "Fuzz Title", slug: slug(), author: "An Author", format: "EPUB", price: "100", currency: "KES", ...over }));

    it("should create a draft work and edition, never live", async () => {
      const s = slug();
      expect((await make({ slug: s })).ok).toBe(true);
      const ed = await db.edition.findFirstOrThrow({ where: { work: { slug: s } } });
      expect(ed.isActive).toBe(false);
      expect(Number(ed.price)).toBe(100);
    });

    const rejected: [string, Record<string, string | undefined>][] = [
      ["slug upper-case", { slug: "My-Book" }],
      ["slug with spaces", { slug: "my book" }],
      ["slug unicode", { slug: "café-book" }],
      ["slug emoji", { slug: "book-😀" }],
      ["slug underscore", { slug: "my_book" }],
      ["slug leading dash", { slug: "-book" }],
      ["slug trailing dash", { slug: "book-" }],
      ["slug double dash", { slug: "my--book" }],
      ["slug 2 chars", { slug: "ab" }],
      ["slug 81 chars", { slug: "a".repeat(81) }],
      ["slug with slash", { slug: "a/b/c" }],
      ["slug traversal", { slug: "../../etc/passwd" }],
      ["slug html", { slug: "<script>alert(1)</script>" }],
      ["slug sql", { slug: `a';drop--` }],
      ["slug NUL", { slug: `ab${NUL}c` }],
      ["slug empty", { slug: "" }],
      ["title empty", { title: "" }],
      ["title whitespace", { title: "   " }],
      ["title 201", { title: "t".repeat(201) }],
      ["title NUL", { title: `a${NUL}b` }],
      ["author empty", { author: "" }],
      ["author 121", { author: "a".repeat(121) }],
      ["description 2001", { description: "d".repeat(2001) }],
      ["format lower-case", { format: "epub" }],
      ["format PAPERBACK", { format: "PAPERBACK" }],
      ["format empty", { format: "" }],
      ["price 0", { price: "0" }],
      ["price -1", { price: "-1" }],
      ["price empty", { price: "" }],
      ["price text", { price: "1,000" }],
      ["price NaN", { price: "NaN" }],
      ["price Infinity", { price: "Infinity" }],
      ["price 1e21", { price: "1e21" }],
      ["price 1000000.01", { price: "1000000.01" }],
      ["currency 2 letters", { currency: "KE" }],
      ["currency 4 letters", { currency: "KESS" }],
      ["currency digits", { currency: "K3S" }],
      ["currency unicode", { currency: "ÄÖÜ" }],
      ["narrator 121 (audiobook)", { format: "AUDIOBOOK", narrator: "n".repeat(121) }],
    ];
    it.each(rejected)("should refuse %s and write nothing", async (_n, over) => {
      const before = await counts();
      const r = await make(over);
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates/i);
      expect(await counts()).toEqual(before);
    });

    it.each([
      ["slug 80 chars", { slug: `${prefix}-${"a".repeat(80)}`.slice(0, 80) }, true],
      ["slug with digits", { slug: `${prefix}-2026-edition` }, true],
      ["lower-case currency is upper-cased", { currency: "kes" }, true],
      ["empty currency defaults to KES", { currency: "" }, true],
      ["price 1000000", { price: "1000000" }, true],
      ["title 200 chars", { title: "t".repeat(200) }, true],
      ["title with html kept as text", { title: `<script>alert(1)</script> "><img src=x onerror=1>` }, true],
      ["title with accents", { title: "Café déjà vu" }, true],
      ["description 2000", { description: "d".repeat(2000) }, true],
      ["audiobook with narrator", { format: "AUDIOBOOK", narrator: "Narrator" }, true],
    ] as const)("should handle %s", async (_n, over, ok) => {
      expect((await make({ ...over } as Record<string, string | undefined>)).ok).toBe(ok);
    });

    it("should store a hostile title exactly as typed", async () => {
      const title = `<script>alert(1)</script> "><img src=x onerror=1> '; DROP TABLE "user";--`;
      const s = slug();
      await make({ title, slug: s });
      expect((await db.work.findUniqueOrThrow({ where: { slug: s } })).title).toBe(title);
    });

    it.fails("BUG(Med) lib/admin/content.ts:368,378 a price below 0.005 (e.g. 0.001) passes 'more than zero' and is stored as 0.00", async () => {
      const s = slug();
      await make({ slug: s, price: "0.001" });
      const ed = await db.edition.findFirst({ where: { work: { slug: s } } });
      expect(ed === null || Number(ed.price) > 0).toBe(true);
    });

    it.fails("BUG(Med) lib/admin/content.ts:375 an existing slug silently adds a SECOND edition of the same format to that book (typo in a slug edits someone else's book); the form should refuse a duplicate format", async () => {
      const s = slug();
      await make({ slug: s });
      const again = await make({ slug: s });
      expect(again.ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("chapters", () => {
    const save = (editionId: string, over: Record<string, string | undefined> = {}) => actions.saveChapterAction(null, form({ editionId, title: "Chapter", body: "one two three", ...over }));

    it("should normalise line endings and blank lines, store the word count, and keep the body text as typed", async () => {
      const d = await draft();
      const html = '<script>alert(1)</script>\r\n\r\n\r\n\r\n"><img src=x onerror=1>';
      expect((await save(d.editionId, { body: html, title: "<b>t</b>" })).ok).toBe(true);
      const ch = await db.chapter.findFirstOrThrow({ where: { editionId: d.editionId } });
      expect(ch.body).toBe('<script>alert(1)</script>\n\n"><img src=x onerror=1>');
      expect(ch.title).toBe("<b>t</b>");
      expect(ch.wordCount).toBe(4);
    });

    const rejected: [string, Record<string, string | undefined>][] = [
      ["title empty", { title: "" }],
      ["title whitespace", { title: "    " }],
      ["title 201", { title: "t".repeat(201) }],
      ["title NUL", { title: `a${NUL}b` }],
      ["body 500001 chars", { body: "b".repeat(500_001) }],
      ["body 10x max", { body: "b".repeat(5_000_000) }],
      ["body NUL", { body: `a${NUL}b` }],
      ["edition missing", { editionId: "" }],
      ["edition unknown", { editionId: "nope" }],
      ["edition NUL", { editionId: `a${NUL}` }],
    ];
    it.each(rejected)("should refuse %s and write nothing", async (_n, over) => {
      const d = await draft();
      const before = await counts();
      const r = await save(d.editionId, over);
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates/i);
      expect(await counts()).toEqual(before);
    });

    it.each([
      ["title 200", { title: "t".repeat(200) }],
      ["title with newline and tab", { title: "a\nb\tc" }],
      ["body exactly 500000", { body: "b".repeat(500_000) }],
      ["empty body", { body: "" }],
      ["only whitespace body", { body: " \n\n\t " }],
      ["accented text", { body: "café déjà vu" }],
    ])("should accept %s", async (_n, over) => {
      const d = await draft();
      expect((await save(d.editionId, over)).ok).toBe(true);
    });

    it("should append chapters with consecutive numbers and edit in place, and refuse another book's chapter id", async () => {
      const a = await draft();
      const b = await draft();
      await save(a.editionId);
      await save(a.editionId);
      const chapters = await db.chapter.findMany({ where: { editionId: a.editionId }, orderBy: { idx: "asc" } });
      expect(chapters.map((c) => c.idx)).toEqual([0, 1]);
      const before = await counts();
      const stolen = await save(b.editionId, { chapterId: chapters[0].id });
      expect(stolen).toMatchObject({ ok: false, message: "Chapter not found." });
      expect(await counts()).toEqual(before);
    });

    it("should demand a reason of 10..500 chars once the book is live or owned, and not before", async () => {
      const d = await draft();
      await save(d.editionId);
      await db.entitlement.create({ data: { userId: victim.id, editionId: d.editionId } });
      const chapter = await db.chapter.findFirstOrThrow({ where: { editionId: d.editionId } });
      for (const [reason, ok] of [[undefined, false], ["123456789", false], ["1234567890", true], ["r".repeat(501), false]] as const) {
        const r = await save(d.editionId, { chapterId: chapter.id, body: "new text " + String(reason).length, reason });
        expect(r.ok).toBe(ok);
      }
    });

    it("should never write chapter text into the audit log", async () => {
      const d = await draft();
      await save(d.editionId, { body: "TOP-SECRET-MANUSCRIPT-LINE" });
      const rows = await db.auditLog.findMany({ where: { adminId: owner.id, action: "chapter.added", targetType: "chapter" } });
      expect(JSON.stringify(rows)).not.toContain("TOP-SECRET-MANUSCRIPT-LINE");
    });

    it("should treat an unknown move direction as 'down' (documented) and refuse moves past either end", async () => {
      const d = await draft();
      await save(d.editionId, { title: "One" });
      await save(d.editionId, { title: "Two" });
      const [first, second] = await db.chapter.findMany({ where: { editionId: d.editionId }, orderBy: { idx: "asc" } });
      expect((await actions.moveChapterAction(null, form({ chapterId: first.id, dir: "up" }))).message).toBe("This is already the first chapter.");
      expect((await actions.moveChapterAction(null, form({ chapterId: second.id, dir: "down" }))).message).toBe("This is already the last chapter.");
      expect((await actions.moveChapterAction(null, form({ chapterId: first.id, dir: "sideways" }))).ok).toBe(true);
      expect((await db.chapter.findUniqueOrThrow({ where: { id: first.id } })).idx).toBe(1);
    });

    it.fails("BUG(Low) app/admin/actions.ts:216 any unknown direction (e.g. 'UP', 'sideways', '') silently moves the chapter DOWN instead of being refused", async () => {
      const d = await draft();
      await save(d.editionId, { title: "One" });
      await save(d.editionId, { title: "Two" });
      const first = await db.chapter.findFirstOrThrow({ where: { editionId: d.editionId, idx: 0 } });
      const r = await actions.moveChapterAction(null, form({ chapterId: first.id, dir: "UP" }));
      expect(r.ok).toBe(false);
    });

    it("should only delete the last chapter and refuse once readers have a place saved", async () => {
      const d = await draft();
      await save(d.editionId, { title: "One" });
      await save(d.editionId, { title: "Two" });
      const [first, second] = await db.chapter.findMany({ where: { editionId: d.editionId }, orderBy: { idx: "asc" } });
      expect((await actions.deleteChapterAction(null, form({ chapterId: first.id }))).message).toMatch(/last chapter/);
      await db.bookmark.create({ data: { userId: victim.id, editionId: d.editionId, chapterIdx: 0, position: 0 } });
      expect((await actions.deleteChapterAction(null, form({ chapterId: second.id }))).message).toMatch(/place saved/);
      expect(await db.chapter.count({ where: { editionId: d.editionId } })).toBe(2);
      expect((await actions.deleteChapterAction(null, form({ chapterId: "nope" }))).ok).toBe(false);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("importManuscriptAction", () => {
    const imp = (editionId: string, manuscript: string, reason?: string) => actions.importManuscriptAction(null, form({ editionId, manuscript, reason }));
    const chaptersOf = (editionId: string) => db.chapter.count({ where: { editionId } });

    it("should import chapters at '## ' headings, ignoring text before the first heading, with CRLF input", async () => {
      const d = await draft();
      const r = await imp(d.editionId, "Preface ignored\r\n\r\n## One\r\nHello there\r\n\r\n\r\n\r\nSecond\r\n## Two\r\nBye");
      expect(r).toEqual({ ok: true, message: "2 chapters added." });
      const rows = await db.chapter.findMany({ where: { editionId: d.editionId }, orderBy: { idx: "asc" } });
      expect(rows.map((c) => [c.idx, c.title, c.body, c.wordCount])).toEqual([[0, "One", "Hello there\n\nSecond", 3], [1, "Two", "Bye", 1]]);
    });

    it.each([
      ["no headings", "just some text with no heading at all"],
      ["empty", ""],
      ["whitespace", "   \n\n  "],
      ["heading without a space", "##NoSpace\nbody"],
      ["a single-hash heading", "# One\nbody"],
      ["an empty title mid-text", "## \nbody\n## Two\nx"],
      ["a 201 char title", `## ${"t".repeat(201)}\nbody`],
      ["a chapter over 500000 chars", `## Big\n${"b".repeat(500_001)}`],
      ["201 chapters", Array.from({ length: 201 }, (_, i) => `## C${i}\nx`).join("\n")],
      ["1000 chapters", Array.from({ length: 1000 }, (_, i) => `## C${i}\nx`).join("\n")],
      ["a manuscript over 10 MB", `## A\n${"w ".repeat(5_000_001)}`],
      ["a NUL byte", `## A\nbad${NUL}byte`],
    ])("should refuse %s and add no chapters at all (all or nothing)", async (_n, text) => {
      const d = await draft();
      const before = await counts();
      const r = await imp(d.editionId, text);
      expect(r.ok).toBe(false);
      expect(r.message).not.toMatch(/prisma|invocation|SELECT|violates/i);
      expect(await chaptersOf(d.editionId)).toBe(0);
      expect(await counts()).toEqual(before);
    });

    it("should accept exactly 200 chapters, headings with no body, hostile titles and giant (but legal) chapters", async () => {
      const d = await draft();
      const text = [`## <script>alert(1)</script>`, "text", `## '; DROP TABLE "user";--`, "", ...Array.from({ length: 198 }, (_, i) => `## C${i}\nx`)].join("\n");
      expect((await imp(d.editionId, text)).ok).toBe(true);
      expect(await chaptersOf(d.editionId)).toBe(200);
      expect((await db.chapter.findFirstOrThrow({ where: { editionId: d.editionId, idx: 0 } })).title).toBe("<script>alert(1)</script>");
    });

    it("should refuse an audiobook edition, an unknown edition, and a live owned book", async () => {
      const audio = await draft("AUDIOBOOK");
      const before = await counts();
      expect((await imp(audio.editionId, "## A\nx")).message).toBe("Manuscript import is for ebook editions.");
      expect((await imp("nope", "## A\nx")).ok).toBe(false);
      expect((await imp(`a${NUL}`, "## A\nx")).ok).toBe(false);
      const live = await draft();
      await db.edition.update({ where: { id: live.editionId }, data: { isActive: true } });
      await db.entitlement.create({ data: { userId: victim.id, editionId: live.editionId } });
      expect((await imp(live.editionId, "## A\nx", GOOD_REASON)).message).toMatch(/live and already owned/);
      expect((await counts()).chapters).toBe(before.chapters);
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("attachChapterAudioAction", () => {
    async function audioChapter() {
      const d = await draft("AUDIOBOOK");
      await actions.saveChapterAction(null, form({ editionId: d.editionId, title: "A1", body: "" }));
      const ch = await db.chapter.findFirstOrThrow({ where: { editionId: d.editionId } });
      return { ...d, chapterId: ch.id, key: `editions/${d.editionId}/audio/${ch.id}-aabbccddeeff.mp3` };
    }
    const attach = (chapterId: string, key: string, durationSeconds: string, reason?: string) => actions.attachChapterAudioAction(null, form({ chapterId, key, durationSeconds, reason }));

    it("should attach a plausible file (64-400 kbps) and record the duration", async () => {
      const c = await audioChapter();
      mocks.headObject.mockResolvedValue({ contentType: "audio/mpeg", sizeBytes: 1_000_000 });
      expect((await attach(c.chapterId, c.key, "60")).ok).toBe(true);
      expect((await db.chapter.findUniqueOrThrow({ where: { id: c.chapterId } })).durationSeconds).toBe(60);
    });

    it.each([
      ["duration 0", "0"],
      ["duration -1", "-1"],
      ["duration empty (Number('') is 0)", ""],
      ["duration text", "abc"],
      ["duration Infinity", "Infinity"],
      ["duration 21601", "21601"],
      ["duration 1e21", "1e21"],
    ])("should refuse %s without touching storage or the database", async (_n, seconds) => {
      const c = await audioChapter();
      mocks.headObject.mockResolvedValue({ contentType: "audio/mpeg", sizeBytes: 1_000_000 });
      const before = await counts();
      expect((await attach(c.chapterId, c.key, seconds)).ok).toBe(false);
      expect(await counts()).toEqual(before);
    });

    it.each([
      ["a key in another edition's folder", (c: { key: string }) => c.key.replace(/editions\/[^/]+/, "editions/other")],
      ["a key with a path inside the file name", (c: { key: string }) => c.key.replace("aabbccddeeff.mp3", "../../x.mp3")],
      ["a key with spaces", (c: { key: string }) => c.key + " x"],
      ["a key with a NUL byte", (c: { key: string }) => c.key + NUL],
      ["a key with unicode", (c: { key: string }) => c.key + "é"],
      ["an empty key", () => ""],
      ["a key with a query string", (c: { key: string }) => c.key + "?x=1"],
    ])("should refuse %s", async (_n, mk) => {
      const c = await audioChapter();
      mocks.headObject.mockResolvedValue({ contentType: "audio/mpeg", sizeBytes: 1_000_000 });
      const before = await counts();
      const r = await attach(c.chapterId, mk(c), "60");
      expect(r.ok).toBe(false);
      expect(await counts()).toEqual(before);
    });

    it("should refuse a missing object, a wrong content type, a wrong size for the length, an unknown chapter and a repeat", async () => {
      const c = await audioChapter();
      mocks.headObject.mockResolvedValueOnce(null);
      expect((await attach(c.chapterId, c.key, "60")).message).toMatch(/not found/);
      mocks.headObject.mockResolvedValueOnce({ contentType: "text/html", sizeBytes: 1_000_000 });
      expect((await attach(c.chapterId, c.key, "60")).message).toMatch(/MP3 or M4A/);
      mocks.headObject.mockResolvedValueOnce({ contentType: "audio/mpeg", sizeBytes: 100 });
      expect((await attach(c.chapterId, c.key, "60")).message).toMatch(/does not match/);
      mocks.headObject.mockResolvedValueOnce({ contentType: "audio/mpeg", sizeBytes: 900_000_000 });
      expect((await attach(c.chapterId, c.key, "60")).message).toMatch(/does not match/);
      expect((await attach("nope", c.key, "60")).ok).toBe(false);
      mocks.headObject.mockResolvedValue({ contentType: "audio/mpeg", sizeBytes: 1_000_000 });
      expect((await attach(c.chapterId, c.key, "60")).ok).toBe(true);
      expect((await attach(c.chapterId, c.key, "60")).message).toBe("That file is already attached.");
    });

    it("should refuse audio on an ebook edition", async () => {
      const e = await draft("EPUB");
      await actions.saveChapterAction(null, form({ editionId: e.editionId, title: "T", body: "x" }));
      const ch = await db.chapter.findFirstOrThrow({ where: { editionId: e.editionId } });
      mocks.headObject.mockResolvedValue({ contentType: "audio/mpeg", sizeBytes: 1_000_000 });
      expect((await attach(ch.id, `editions/${e.editionId}/audio/${ch.id}-aa.mp3`, "60")).message).toBe("Audio can only be added to an audiobook edition.");
    });
  });

  // -------------------------------------------------------------------------------------------------------
  describe("cart and settings server actions", () => {
    let book: { editionId: string };
    let inactive: { editionId: string };
    beforeAll(async () => {
      book = await draft();
      await db.edition.update({ where: { id: book.editionId }, data: { isActive: true } });
      inactive = await draft();
    });
    const cartOf = async (userId: string) => (await db.cartItem.findMany({ where: { cart: { userId } } })).map((i) => i.editionId);

    it("should merge only active, unowned editions once each, whatever the duplicates", async () => {
      const u = await mkUser();
      asUser(u);
      await mergeCart([book.editionId, book.editionId, inactive.editionId, "nope"]);
      await mergeCart([book.editionId]);
      expect(await cartOf(u.id)).toEqual([book.editionId]);
    });

    it("should drop editions the person already owns", async () => {
      const u = await mkUser();
      asUser(u);
      await db.entitlement.create({ data: { userId: u.id, editionId: book.editionId } });
      await mergeCart([book.editionId]);
      expect(await cartOf(u.id)).toEqual([]);
    });

    it.each([
      ["a string", "abc"],
      ["null", null],
      ["undefined", undefined],
      ["an object", { 0: "x" }],
      ["numbers", [1, 2]],
      ["nested arrays", [["a"]]],
      ["11 ids", Array.from({ length: 11 }, (_, i) => `e${i}`)],
      ["an empty array", []],
      ["a 65 char id", ["a".repeat(65)]],
    ])("should ignore %s without throwing and without writing", async (_n, input) => {
      const u = await mkUser();
      asUser(u);
      await expect(mergeCart(input as unknown as string[])).resolves.toBeUndefined();
      await expect(removeFromCart(input as unknown as string[])).resolves.toBeUndefined();
      expect(await cartOf(u.id)).toEqual([]);
    });

    it("should do nothing for a signed-out visitor", async () => {
      asUser(null);
      await expect(mergeCart([book.editionId])).resolves.toBeUndefined();
      await expect(removeFromCart([book.editionId])).resolves.toBeUndefined();
    });

    it("should remove only the caller's own cart lines (another person's cart is untouched)", async () => {
      const a = await mkUser();
      const b = await mkUser();
      for (const u of [a, b]) {
        asUser(u);
        await mergeCart([book.editionId]);
      }
      asUser(a);
      await removeFromCart([book.editionId]);
      expect(await cartOf(a.id)).toEqual([]);
      expect(await cartOf(b.id)).toEqual([book.editionId]);
    });

    it.fails("BUG(Med) app/actions/cart.ts:45 mergeCart(['a<NUL>']) throws (Postgres rejects NUL) because, unlike removeFromCart, it is not wrapped in traced(): the server action fails with a 500", async () => {
      asUser(await mkUser());
      await expect(mergeCart([`a${NUL}`])).resolves.toBeUndefined();
    });

    describe("updatePreferences", () => {
      it("should save two booleans for the caller only", async () => {
        const u = await mkUser();
        asUser(u);
        expect(await updatePreferences({ emailNotifications: false, smsNotifications: true })).toEqual({ ok: true });
        expect(await db.userPreferences.findUniqueOrThrow({ where: { userId: u.id } })).toMatchObject({ emailNotifications: false, smsNotifications: true });
      });

      it("should ignore a smuggled userId or extra fields and never touch another account", async () => {
        const u = await mkUser();
        const other = await mkUser();
        asUser(u);
        await updatePreferences({ emailNotifications: false, smsNotifications: false, userId: other.id, role: "owner" } as never);
        expect(await db.userPreferences.count({ where: { userId: other.id } })).toBe(0);
        expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("reader");
      });

      it.each([
        ["strings", { emailNotifications: "false", smsNotifications: "true" }],
        ["numbers", { emailNotifications: 0, smsNotifications: 1 }],
        ["null", { emailNotifications: null, smsNotifications: true }],
        ["missing", { emailNotifications: true }],
        ["undefined input", undefined],
        ["null input", null],
        ["an array", [true, true]],
      ])("should refuse %s with ok:false and write nothing", async (_n, input) => {
        const u = await mkUser();
        asUser(u);
        expect(await updatePreferences(input as never)).toEqual({ ok: false });
        expect(await db.userPreferences.count({ where: { userId: u.id } })).toBe(0);
      });

      it("should answer ok:false for a signed-out visitor", async () => {
        asUser(null);
        expect(await updatePreferences({ emailNotifications: true, smsNotifications: true })).toEqual({ ok: false });
      });
    });
  });
});
