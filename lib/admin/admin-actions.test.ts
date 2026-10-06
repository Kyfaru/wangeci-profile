import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Database tests: run only when TEST_DATABASE_URL points at a throwaway local database.
const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

const mocks = vi.hoisted(() => ({ refund: vi.fn(), notify: vi.fn(async () => {}) }));

vi.mock("@/lib/payments", () => ({ getProvider: () => ({ refund: mocks.refund }) }));
vi.mock("@/lib/server/notifier", () => ({ notify: mocks.notify }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});

import { AdminError, grantComplimentaryAccess, recordManualRefund, requestRefund, revokeComplimentaryAccess, setBan, setEditionActive, setRole } from "./actions";

describe.skipIf(!url)("admin writes (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const stamp = Date.now();
  let n = 0;
  const made = { users: [] as string[], works: [] as string[] };
  const REASON = "Customer asked for this by email";

  async function user(role = "reader") {
    n += 1;
    const u = await db.user.create({ data: { name: `U${n}`, email: `adm-${stamp}-${n}@example.com`, emailVerified: true, role } });
    made.users.push(u.id);
    return u;
  }
  async function paidOrder(provider: "PAYSTACK" | "MPESA" = "PAYSTACK") {
    n += 1;
    const buyer = await user();
    const work = await db.work.create({ data: { slug: `adm-w-${stamp}-${n}`, title: "W", author: "A" } });
    made.works.push(work.id);
    const edition = await db.edition.create({ data: { workId: work.id, format: "EPUB", price: "500.00" } });
    await db.chapter.create({ data: { editionId: edition.id, idx: 0, title: "c", wordCount: 1 } });
    const order = await db.order.create({ data: { userId: buyer.id, totalAmount: "500.00", status: "PAID", provider, providerReference: `ref-${stamp}-${n}`, paidAt: new Date(), items: { create: { editionId: edition.id, unitPrice: "500.00" } } } });
    await db.entitlement.create({ data: { userId: buyer.id, editionId: edition.id, orderId: order.id } });
    return { buyer, edition, order, work };
  }
  const audit = (targetId: string) => db.auditLog.findMany({ where: { targetId }, orderBy: { createdAt: "asc" } });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { adminId: { in: made.users } } });
    await db.entitlement.deleteMany({ where: { userId: { in: made.users } } });
    await db.order.deleteMany({ where: { userId: { in: made.users } } });
    await db.user.deleteMany({ where: { id: { in: made.users } } });
    await db.work.deleteMany({ where: { id: { in: made.works } } });
    await db.$disconnect();
  });

  it("refunds need a real reason", async () => {
    const admin = await user("owner");
    const { order } = await paidOrder();
    await expect(requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: "no" })).rejects.toBeInstanceOf(AdminError);
    expect(mocks.refund).not.toHaveBeenCalled();
    expect(await audit(order.id)).toHaveLength(0);
  });

  it("a card refund request: pending flag and audit row, provider asked, order NOT marked refunded", async () => {
    const admin = await user("owner");
    const { order, buyer } = await paidOrder();
    mocks.refund.mockResolvedValueOnce({ ok: true });
    await requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON });

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID"); // only the signed provider event may change this
    expect(after.refundRequestedAt).not.toBeNull();
    expect(after.refundRequestedById).toBe(admin.id);
    expect(mocks.refund).toHaveBeenCalledWith({ reference: order.providerReference, amount: 500, reason: REASON });
    expect(await db.entitlement.count({ where: { userId: buyer.id } })).toBe(1); // access untouched
    expect((await audit(order.id)).map((a) => a.action)).toEqual(["refund.requested"]);

    await expect(requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/already been requested/);
  });

  it("two refund clicks at once: the provider is asked exactly once", async () => {
    const admin = await user("owner");
    const { order } = await paidOrder();
    mocks.refund.mockResolvedValue({ ok: true });
    const results = await Promise.allSettled([requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON }), requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(mocks.refund).toHaveBeenCalledTimes(1);
  });

  it("if the provider refuses, the order is unchanged and 'refund.failed' is recorded", async () => {
    const admin = await user("owner");
    const { order } = await paidOrder();
    mocks.refund.mockRejectedValueOnce(new Error("Paystack said no"));
    await expect(requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/refused/);
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");
    expect(after.refundRequestedAt).toBeNull();
    expect((await audit(order.id)).map((a) => a.action)).toEqual(["refund.requested", "refund.failed"]);
  });

  it("refund guards: only PAID orders, and M-Pesa cannot be refunded automatically", async () => {
    const admin = await user("owner");
    const { order } = await paidOrder();
    await db.order.update({ where: { id: order.id }, data: { status: "PENDING" } });
    await expect(requestRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/paid order/);
    const mp = await paidOrder("MPESA");
    await expect(requestRefund({ orderId: mp.order.id, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/manual refund/);
  });

  it("manual M-Pesa refund: REFUNDED, access gone, audited with the reference", async () => {
    const admin = await user("owner");
    const { order, buyer } = await paidOrder("MPESA");
    await expect(recordManualRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON, reference: "x" })).rejects.toBeTruthy();
    await recordManualRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON, reference: "QWE123RTY" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
    expect(await db.entitlement.count({ where: { userId: buyer.id } })).toBe(0);
    const rows = await audit(order.id);
    expect(rows.map((a) => a.action)).toEqual(["refund.completed"]);
    expect(JSON.stringify(rows[0].meta)).toContain("QWE123RTY");
    await expect(recordManualRefund({ orderId: order.id, actor: { id: admin.id }, reason: REASON, reference: "QWE123RTY" })).rejects.toThrow(/paid order/);
    const card = await paidOrder("PAYSTACK");
    await expect(recordManualRefund({ orderId: card.order.id, actor: { id: admin.id }, reason: REASON, reference: "QWE123RTY" })).rejects.toThrow(/automatically/);
  });

  it("complimentary access: granted with a reason, never counts as an order, revocable; paid access is not", async () => {
    const admin = await user("owner");
    const customer = await user();
    const { edition, order, buyer } = await paidOrder();
    await expect(grantComplimentaryAccess({ userId: customer.id, editionId: edition.id, actor: { id: admin.id }, reason: "x" })).rejects.toBeInstanceOf(AdminError);
    await grantComplimentaryAccess({ userId: customer.id, editionId: edition.id, actor: { id: admin.id }, reason: REASON });
    const row = await db.entitlement.findUniqueOrThrow({ where: { userId_editionId: { userId: customer.id, editionId: edition.id } } });
    expect(row.orderId).toBeNull();
    expect(await db.order.count({ where: { userId: customer.id } })).toBe(0); // no revenue
    await expect(grantComplimentaryAccess({ userId: customer.id, editionId: edition.id, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/already has access/);

    await revokeComplimentaryAccess({ entitlementId: row.id, actor: { id: admin.id }, reason: REASON });
    expect(await db.entitlement.findUnique({ where: { id: row.id } })).toBeNull();
    const paid = await db.entitlement.findUniqueOrThrow({ where: { userId_editionId: { userId: buyer.id, editionId: edition.id } } });
    expect(paid.orderId).toBe(order.id);
    await expect(revokeComplimentaryAccess({ entitlementId: paid.id, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/Refund the order/);
    expect((await audit(row.id)).map((a) => a.action)).toEqual(["access.granted", "access.revoked"]);
  });

  it("banning signs the customer out everywhere, cannot hit staff or yourself, and is audited", async () => {
    const admin = await user("owner");
    const customer = await user();
    await db.session.create({ data: { userId: customer.id, token: `t-${stamp}-${n}`, expiresAt: new Date(Date.now() + 60_000) } });
    await setBan({ userId: customer.id, banned: true, actor: { id: admin.id }, reason: REASON });
    const banned = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(banned.banned).toBe(true);
    expect(banned.banReason).toBe(REASON);
    expect(await db.session.count({ where: { userId: customer.id } })).toBe(0);
    await setBan({ userId: customer.id, banned: false, actor: { id: admin.id }, reason: REASON });
    expect((await db.user.findUniqueOrThrow({ where: { id: customer.id } })).banned).toBe(false);
    expect((await audit(customer.id)).map((a) => a.action)).toEqual(["customer.banned", "customer.unbanned"]);

    await expect(setBan({ userId: admin.id, banned: true, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/yourself/);
    const staff = await user("support");
    await expect(setBan({ userId: staff.id, banned: true, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/role to reader/);
  });

  it("role changes: not to owner, not for owners, not for yourself; sessions end; audited", async () => {
    const admin = await user("owner");
    const person = await user();
    await db.session.create({ data: { userId: person.id, token: `r-${stamp}-${n}`, expiresAt: new Date(Date.now() + 60_000) } });
    await setRole({ userId: person.id, role: "support", actor: { id: admin.id }, reason: REASON });
    expect((await db.user.findUniqueOrThrow({ where: { id: person.id } })).role).toBe("support");
    expect(await db.session.count({ where: { userId: person.id } })).toBe(0);
    expect((await audit(person.id)).map((a) => a.action)).toEqual(["role.changed"]);

    // @ts-expect-error "owner" is deliberately not an assignable role
    await expect(setRole({ userId: person.id, role: "owner", actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/cannot be assigned/);
    await expect(setRole({ userId: admin.id, role: "support", actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/own role/);
    const other = await user("owner");
    await expect(setRole({ userId: other.id, role: "reader", actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/owner role/);
  });

  it("publishing needs chapters, retiring keeps owners' access, both audited", async () => {
    const admin = await user("owner");
    const { edition, buyer } = await paidOrder();
    await setEditionActive({ editionId: edition.id, active: false, actor: { id: admin.id }, reason: REASON });
    expect((await db.edition.findUniqueOrThrow({ where: { id: edition.id } })).isActive).toBe(false);
    expect(await db.entitlement.count({ where: { userId: buyer.id, editionId: edition.id } })).toBe(1);
    await setEditionActive({ editionId: edition.id, active: true, actor: { id: admin.id }, reason: REASON });
    const empty = await db.edition.create({ data: { workId: edition.workId, format: "AUDIOBOOK", price: "1.00", isActive: false } });
    await expect(setEditionActive({ editionId: empty.id, active: true, actor: { id: admin.id }, reason: REASON })).rejects.toThrow(/chapters/);
    expect((await audit(edition.id)).map((a) => a.action)).toEqual(["edition.retired", "edition.published"]);
  });
});
