import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Money-path tests. They need a throwaway local database:
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/wangeci pnpm test
const url = process.env.TEST_DATABASE_URL;
const fallbackUrl = "postgresql://unused:unused@localhost:1/unused";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  notify: vi.fn(async () => {}),
  notifyAdmins: vi.fn(async () => {}),
  captureMessage: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", BETTER_AUTH_URL: "http://localhost:3000", PAYSTACK_SECRET_KEY: "sk_test_x" } }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});
vi.mock("@/lib/payments", () => ({ getProvider: () => ({ verify: mocks.verify }) }));
vi.mock("@/lib/server/notifier", () => ({ notify: mocks.notify }));
vi.mock("@/lib/server/notify-admins", () => ({ notifyAdmins: mocks.notifyAdmins }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(async () => ({ id: "e" })) }));
vi.mock("@/lib/sms", () => ({ sendSms: vi.fn(async () => ({})) }));
vi.mock("@/lib/checkout/attempt-ladder", () => ({ payLadder: { clear: vi.fn(async () => {}) } }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: mocks.captureMessage, captureException: vi.fn() }));

import { applyProviderEvent } from "./apply-event";
import { CheckoutError, createPendingOrder } from "./create";

describe.skipIf(!url)("money path (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? fallbackUrl } } });
  const stamp = Date.now();
  let seq = 0;
  const created = { users: [] as string[], works: [] as string[] };

  async function fixtures(price = "500.00") {
    seq += 1;
    const user = await db.user.create({ data: { name: "Buyer", email: `buyer-${stamp}-${seq}@example.com`, emailVerified: true } });
    const work = await db.work.create({ data: { slug: `w-${stamp}-${seq}`, title: `Book ${seq}`, author: "A" } });
    const edition = await db.edition.create({ data: { workId: work.id, format: "EPUB", price } });
    created.users.push(user.id);
    created.works.push(work.id);
    return { user, work, edition };
  }

  async function pendingOrder(provider: "PAYSTACK" | "MPESA" = "PAYSTACK", price = "500.00") {
    const f = await fixtures(price);
    const reference = `ref-${stamp}-${seq}`;
    const order = await db.order.create({
      data: { userId: f.user.id, totalAmount: price, provider, providerReference: reference, items: { create: { editionId: f.edition.id, unitPrice: price } } },
    });
    return { ...f, order, reference };
  }

  const success = (reference: string, amount = 500, currency = "KES", provider: "PAYSTACK" | "MPESA" = "PAYSTACK") =>
    ({ type: "payment.succeeded", provider, reference, amount, currency }) as const;

  beforeEach(() => vi.clearAllMocks());

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { adminId: { in: created.users } } });
    await db.entitlement.deleteMany({ where: { userId: { in: created.users } } });
    await db.order.deleteMany({ where: { userId: { in: created.users } } });
    await db.user.deleteMany({ where: { id: { in: created.users } } });
    await db.work.deleteMany({ where: { id: { in: created.works } } });
    await db.$disconnect();
  });

  it("grants access once, and a repeated webhook changes nothing", async () => {
    const { order, user, reference } = await pendingOrder();
    expect(await applyProviderEvent(success(reference))).toBe("granted");
    expect(await applyProviderEvent(success(reference))).toBe("noop");
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it("two simultaneous webhooks: exactly one wins", async () => {
    const { user, reference } = await pendingOrder();
    const results = await Promise.all([applyProviderEvent(success(reference)), applyProviderEvent(success(reference)), applyProviderEvent(success(reference))]);
    expect(results.filter((r) => r === "granted")).toHaveLength(1);
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(1);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });

  it("refuses an amount mismatch and raises an urgent alert", async () => {
    const { order, user, reference } = await pendingOrder();
    expect(await applyProviderEvent(success(reference, 50))).toBe("mismatch");
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(mocks.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ type: "payment_mismatch", urgent: true }));
    expect(mocks.captureMessage).toHaveBeenCalled();
  });

  it("refuses a currency mismatch", async () => {
    const { user, reference } = await pendingOrder();
    expect(await applyProviderEvent(success(reference, 500, "USD"))).toBe("mismatch");
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(0);
  });

  it("ignores a success for a reference we never issued", async () => {
    expect(await applyProviderEvent(success("never-issued"))).toBe("noop");
  });

  it("a failed payment marks the order FAILED, never downgrades PAID, and money that arrives late still grants", async () => {
    const { order, user, reference } = await pendingOrder();
    expect(await applyProviderEvent({ type: "payment.failed", provider: "PAYSTACK", reference, reason: "declined" })).toBe("failed");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FAILED");

    expect(await applyProviderEvent(success(reference))).toBe("granted"); // the buyer really paid
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(1);

    expect(await applyProviderEvent({ type: "payment.failed", provider: "PAYSTACK", reference })).toBe("noop");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });

  it("a refund removes access, keeps complimentary access, and writes the audit row", async () => {
    const { order, user, reference, edition, work } = await pendingOrder();
    const admin = await db.user.create({ data: { name: "Admin", email: `admin-${stamp}-${seq}@example.com`, role: "owner" } });
    created.users.push(admin.id);
    await applyProviderEvent(success(reference));
    const comp = await db.edition.create({ data: { workId: work.id, format: "AUDIOBOOK", price: "1.00" } });
    await db.entitlement.create({ data: { userId: user.id, editionId: comp.id, orderId: null } }); // complimentary

    // A refund nobody asked for is ignored.
    expect(await applyProviderEvent({ type: "refund.processed", provider: "PAYSTACK", reference })).toBe("noop");

    await db.order.update({ where: { id: order.id }, data: { refundRequestedAt: new Date(), refundRequestedById: admin.id } });
    expect(await applyProviderEvent({ type: "refund.processed", provider: "PAYSTACK", reference })).toBe("refunded");
    expect(await applyProviderEvent({ type: "refund.processed", provider: "PAYSTACK", reference })).toBe("noop"); // once only

    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("REFUNDED");
    expect(await db.entitlement.findUnique({ where: { userId_editionId: { userId: user.id, editionId: edition.id } } })).toBeNull();
    expect(await db.entitlement.findUnique({ where: { userId_editionId: { userId: user.id, editionId: comp.id } } })).not.toBeNull();
    const audit = await db.auditLog.findMany({ where: { targetId: order.id } });
    expect(audit.map((a) => a.action)).toEqual(["refund.completed"]);
  });

  it("a failed refund leaves the order PAID and clears the pending flag", async () => {
    const { order, user, reference } = await pendingOrder();
    const admin = await db.user.create({ data: { name: "Admin", email: `admin2-${stamp}-${seq}@example.com`, role: "owner" } });
    created.users.push(admin.id);
    await applyProviderEvent(success(reference));
    await db.order.update({ where: { id: order.id }, data: { refundRequestedAt: new Date(), refundRequestedById: admin.id } });
    expect(await applyProviderEvent({ type: "refund.failed", provider: "PAYSTACK", reference })).toBe("refund_failed");
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");
    expect(after.refundRequestedAt).toBeNull();
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(1);
  });

  it("M-Pesa: a callback saying 'paid' is only trusted after Safaricom confirms it", async () => {
    const { user, reference } = await pendingOrder("MPESA");
    mocks.verify.mockResolvedValueOnce({ state: "pending" });
    expect(await applyProviderEvent(success(reference, 500, "KES", "MPESA"))).toBe("noop");
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(0);

    mocks.verify.mockResolvedValueOnce({ state: "success" });
    expect(await applyProviderEvent(success(reference, 500, "KES", "MPESA"))).toBe("granted");
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(1);
  });

  it("an event from the wrong provider cannot settle an order", async () => {
    const { user, reference } = await pendingOrder("PAYSTACK");
    expect(await applyProviderEvent(success(reference, 500, "KES", "MPESA"))).toBe("noop");
    expect(await db.entitlement.count({ where: { userId: user.id } })).toBe(0);
  });

  it("checkout takes prices from the database, snapshots them, and ignores anything else", async () => {
    const { user, edition } = await fixtures("750.00");
    const { order, total } = await createPendingOrder({ userId: user.id, editionIds: [edition.id, edition.id], provider: "PAYSTACK" });
    expect(total).toBe(750); // duplicates collapse, price is the database price
    const stored = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    expect(Number(stored.totalAmount)).toBe(750);
    expect(stored.status).toBe("PENDING");
    expect(stored.items).toHaveLength(1);
    expect(Number(stored.items[0].unitPrice)).toBe(750); // snapshot

    await db.edition.update({ where: { id: edition.id }, data: { price: "999.00" } }); // later price change
    expect(Number((await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).unitPrice)).toBe(750);
  });

  it("checkout rejects an edition the buyer already owns, and one that is not for sale", async () => {
    const { user, edition, work } = await fixtures();
    await db.entitlement.create({ data: { userId: user.id, editionId: edition.id } });
    await expect(createPendingOrder({ userId: user.id, editionIds: [edition.id], provider: "PAYSTACK" })).rejects.toMatchObject({ code: "ALREADY_OWNED", status: 409 });

    const paperback = await db.edition.create({ data: { workId: work.id, format: "PAPERBACK", price: "10.00" } });
    const inactive = await db.edition.create({ data: { workId: work.id, format: "AUDIOBOOK", price: "10.00", isActive: false } });
    for (const id of [paperback.id, inactive.id]) {
      await expect(createPendingOrder({ userId: user.id, editionIds: [id], provider: "PAYSTACK" })).rejects.toBeInstanceOf(CheckoutError);
    }
    await expect(createPendingOrder({ userId: user.id, editionIds: [], provider: "PAYSTACK" })).rejects.toMatchObject({ code: "EMPTY" });
  });
});
