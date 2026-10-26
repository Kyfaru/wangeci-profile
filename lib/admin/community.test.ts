import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

// Database tests: run only when TEST_DATABASE_URL points at a throwaway local database.
const url = process.env.TEST_DATABASE_URL;

const mocks = vi.hoisted(() => ({ notifyAdmins: vi.fn(async () => {}), userId: null as string | null }));

vi.mock("@/lib/server/notify-admins", () => ({ notifyAdmins: mocks.notifyAdmins }));
vi.mock("@/lib/server/session", () => ({ getSessionUserId: async () => mocks.userId }));
vi.mock("@/lib/payments", () => ({ getProvider: () => ({}) }));
vi.mock("@/lib/server/notifier", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/lib/catalogue", () => ({ getBookBySlug: async (slug: string) => (slug.startsWith("book-") ? { slug } : null) }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { can } from "@/lib/permissions";
import { submitComment } from "@/lib/community";
import { AdminError, moderateComment, replyToComment } from "./actions";

describe.skipIf(!url)("community (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();
  let n = 0;
  const users: string[] = [];
  const slug = `book-${stamp}`;
  const REASON = "Checked against the house rules";

  async function user(role = "reader") {
    n += 1;
    const u = await db.user.create({ data: { name: `U${n}`, email: `com-${stamp}-${n}@example.com`, emailVerified: true, role } });
    users.push(u.id);
    return u;
  }

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { adminId: { in: users } } });
    await db.comment.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("a comment starts PENDING, is not public, and is public once approved with an audit row", async () => {
    const reader = await user();
    const admin = await user("support");
    const { id } = await submitComment({ userId: reader.id, ip: `ip-${stamp}-a`, slug, body: "Loved it" });

    const publicList = () => db.comment.findMany({ where: { postSlug: slug, status: "APPROVED" } });
    expect((await db.comment.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
    expect(await publicList()).toHaveLength(0);
    expect(mocks.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: `comment:${id}` }));

    await expect(moderateComment({ commentId: id, status: "APPROVED", actor: { id: admin.id }, reason: "no" })).rejects.toBeInstanceOf(AdminError);
    await moderateComment({ commentId: id, status: "APPROVED", actor: { id: admin.id }, reason: REASON });
    expect(await publicList()).toHaveLength(1);
    const audit = await db.auditLog.findMany({ where: { targetId: id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "comment.approved", adminId: admin.id });

    await replyToComment({ commentId: id, body: "Thank you!", actor: { id: admin.id } });
    const reply = await db.comment.findFirstOrThrow({ where: { parentId: id } });
    expect(reply.status).toBe("APPROVED");
  });

  it("is rate limited per user", async () => {
    const reader = await user();
    for (let i = 0; i < 5; i++) await submitComment({ userId: reader.id, ip: `ip-${stamp}-b${i}`, slug, body: "hello" });
    await expect(submitComment({ userId: reader.id, ip: `ip-${stamp}-bx`, slug, body: "hello" })).rejects.toMatchObject({ code: "COMMUNITY_RATE_LIMITED", status: 429 });
  });

  it("refuses an unknown book", async () => {
    const reader = await user();
    await expect(submitComment({ userId: reader.id, ip: `ip-${stamp}-c`, slug: "nope", body: "hello" })).rejects.toMatchObject({ code: "COMMUNITY_BOOK_NOT_FOUND" });
  });
});

describe("community permissions", () => {
  it("support may moderate comments but not owner-only actions; readers may not moderate", () => {
    expect(can("support", "comments.moderate")).toBe(true);
    expect(can("support", "roles.manage")).toBe(false);
    expect(can("support", "order.refund")).toBe(false);
    expect(can("reader", "comments.moderate")).toBe(false);
    expect(can(null, "comments.moderate")).toBe(false);
  });
});


describe("POST /api/community", () => {
  it("refuses a signed-out visitor with 401 AUTH_REQUIRED", async () => {
    const { POST } = await import("@/app/api/community/route");
    mocks.userId = null;
    const res = await POST(new Request("http://x/api/community", { method: "POST", body: JSON.stringify({ kind: "comment", slug: "book-1", body: "hi there" }) }), undefined);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AUTH_REQUIRED" });
  });
});

