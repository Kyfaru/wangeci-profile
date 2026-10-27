import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Guest checkout tests (need the local database, see orders.test.ts).
const url = process.env.TEST_DATABASE_URL;

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn<(p: unknown) => Promise<{ id: string }>>(async () => ({ id: "e" })),
  sendSms: vi.fn<(p: unknown) => Promise<object>>(async () => ({})),
  notifyAdmins: vi.fn<(n: unknown) => Promise<void>>(async () => {}),
}));

vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", BETTER_AUTH_URL: "http://localhost:3000", PAYSTACK_SECRET_KEY: "sk_test_x", CHECKOUT_FEE_PERCENT: 0 } }));
vi.mock("@/lib/prisma", async () => {
  const { PrismaClient: Client } = await import("@prisma/client");
  return { prisma: new Client({ datasources: { db: { url: process.env.TEST_DATABASE_URL ?? "postgresql://unused:unused@localhost:1/unused" } } }) };
});
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/sms", () => ({ sendSms: mocks.sendSms }));
vi.mock("@/lib/server/notifier", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/lib/server/notify-admins", () => ({ notifyAdmins: mocks.notifyAdmins }));
vi.mock("@/lib/payments", () => ({ getProvider: () => ({ verify: vi.fn() }) }));

import { createPendingOrder } from "@/lib/orders/create";
import { markOrderPaid } from "@/lib/orders/grant";
import { afterOrderPaid, invoiceForOrder } from "@/lib/orders/post-paid";
import { hashToken, newClaimToken, resolveBuyer } from "./guest";
import { buildQuote } from "./quote";

describe.skipIf(!url)("guest checkout (database)", () => {
  const db = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://unused:unused@localhost:1/unused" } } });
  const stamp = Date.now();
  let seq = 0;
  const made = { users: new Set<string>(), works: [] as string[], coupons: [] as string[] };

  async function edition(price = "1000.00") {
    seq += 1;
    const work = await db.work.create({ data: { slug: `gw-${stamp}-${seq}`, title: `Guest Book ${seq}`, author: "A" } });
    const e = await db.edition.create({ data: { workId: work.id, format: "EPUB", price } });
    made.works.push(work.id);
    return e;
  }
  async function coupon(data: { code: string; value: number; maxRedemptions?: number }) {
    const c = await db.coupon.create({ data: { code: `${data.code}${stamp}`, type: "PERCENT", value: data.value, maxRedemptions: data.maxRedemptions } });
    made.coupons.push(c.id);
    return c;
  }
  // A unique Kenyan-looking phone per test: +254 7 + 8 digits.
  const details = (n: number) => ({ firstName: "Test", lastName: "Buyer", email: `guest-${stamp}-${n}@example.com`, phone: `+2547${String(stamp).slice(-6)}${String(n).padStart(2, "0")}` });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => {
    const users = [...made.users];
    await db.entitlement.deleteMany({ where: { userId: { in: users } } });
    await db.order.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.coupon.deleteMany({ where: { id: { in: made.coupons } } });
    await db.work.deleteMany({ where: { id: { in: made.works } } });
    await db.$disconnect();
  });

  it("creates an unverified account for a new email, and attaches to an existing one without changing it", async () => {
    const d = details(1);
    const first = await resolveBuyer(d);
    made.users.add(first.userId);
    expect(first.accountCreated).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { id: first.userId } });
    expect(user).toMatchObject({ name: "Test Buyer", emailVerified: false, phoneNumberVerified: false, role: "reader" });
    // Regression (pre-account hijack): the unproven guest phone is not a sign-in factor on the new account.
    expect(user.phoneNumber).toBeNull();
    expect(first.phone).toBe(d.phone); // but the checkout still has it, for the payment prompt and the order

    const again = await resolveBuyer({ ...d, firstName: "Mallory", phone: "+254799999999" });
    expect(again).toMatchObject({ userId: first.userId, accountCreated: false });
    expect((await db.user.findUniqueOrThrow({ where: { id: first.userId } })).name).toBe("Test Buyer"); // nothing overwritten
  });

  it("refuses a phone number that belongs to a different (verified) account", async () => {
    const a = details(2);
    const owner = await db.user.create({ data: { name: "Owner", email: `owner-${stamp}@example.com`, phoneNumber: a.phone, phoneNumberVerified: true } });
    made.users.add(owner.id);
    await expect(resolveBuyer({ ...details(3), phone: a.phone })).rejects.toMatchObject({ code: "PHONE_TAKEN" });
  });

  it("prices a coupon on the server and refuses a used-up or unknown code", async () => {
    const e = await edition("1000.00");
    const c = await coupon({ code: "TEN", value: 10, maxRedemptions: 1 });
    const q = await buildQuote([e.id], c.code);
    expect(q).toMatchObject({ subtotal: 1000, discount: 100, fee: 0, total: 900, couponError: null });
    const unknown = (await buildQuote([e.id], "NOPE-NOT-A-CODE")).couponError;
    await db.coupon.update({ where: { id: c.id }, data: { timesRedeemed: 1 } });
    expect((await buildQuote([e.id], c.code)).couponError).toBe("That code is not valid.");
    expect(unknown).toBe("That code is not valid."); // used-up and unknown cannot be told apart
  });

  it("the last redemption of a code goes to exactly one of two simultaneous checkouts", async () => {
    const e = await edition("1000.00");
    const c = await coupon({ code: "LAST", value: 10, maxRedemptions: 1 });
    const a = await resolveBuyer(details(10));
    const b = await resolveBuyer(details(11));
    made.users.add(a.userId);
    made.users.add(b.userId);
    const results = await Promise.allSettled([a, b].map((u) => createPendingOrder({ userId: u.userId, editionIds: [e.id], provider: "PAYSTACK", coupon: c.code })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ code: "CHECKOUT_COUPON_INVALID", message: "That code is not valid." });
    expect(await db.order.count({ where: { couponId: c.id } })).toBe(1);
  });

  it("one redemption of a code per buyer, even across different books", async () => {
    const [e1, e2] = [await edition("1000.00"), await edition("1000.00")];
    const c = await coupon({ code: "ONCE", value: 10 });
    const buyer = await resolveBuyer(details(12));
    made.users.add(buyer.userId);
    const first = await createPendingOrder({ userId: buyer.userId, editionIds: [e1.id], provider: "PAYSTACK", coupon: c.code });
    await expect(createPendingOrder({ userId: buyer.userId, editionIds: [e2.id], provider: "PAYSTACK", coupon: c.code })).rejects.toMatchObject({ code: "CHECKOUT_COUPON_INVALID" });
    await db.order.update({ where: { id: first.order.id }, data: { status: "FAILED" } }); // a failed attempt frees the code
    await expect(createPendingOrder({ userId: buyer.userId, editionIds: [e2.id], provider: "PAYSTACK", coupon: c.code })).resolves.toMatchObject({ reused: false });
  });

  it("a second M-Pesa checkout for the same books hands back the pending order instead of a second prompt", async () => {
    const e = await edition("500.00");
    const buyer = await resolveBuyer(details(13));
    made.users.add(buyer.userId);
    const first = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], provider: "MPESA", reusePending: true });
    const again = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], provider: "MPESA", reusePending: true });
    expect(again).toMatchObject({ reused: true, order: { id: first.order.id } });
    expect(await db.order.count({ where: { userId: buyer.userId } })).toBe(1);
    // Without the flag (guests) nothing is reused: a stranger typing the email must not be able to block the buyer.
    const guest = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], provider: "MPESA" });
    expect(guest.reused).toBe(false);
  });

  it("paying the same book twice keeps one entitlement, marks both PAID and raises an urgent duplicate alert", async () => {
    const e = await edition("500.00");
    const buyer = await resolveBuyer(details(14));
    made.users.add(buyer.userId);
    const a = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], provider: "PAYSTACK" });
    const b = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], provider: "PAYSTACK" });
    expect(await db.$transaction((tx) => markOrderPaid(a.order.id, { provider: "PAYSTACK" }, tx))).toBe(true);
    await afterOrderPaid(a.order.id);
    expect(mocks.notifyAdmins).not.toHaveBeenCalledWith(expect.objectContaining({ type: "duplicate_payment" }));

    expect(await db.$transaction((tx) => markOrderPaid(b.order.id, { provider: "PAYSTACK" }, tx))).toBe(true);
    await afterOrderPaid(b.order.id);
    expect(await db.entitlement.count({ where: { userId: buyer.userId } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe("PAID");
    expect(mocks.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ type: "duplicate_payment", urgent: true, dedupeKey: `duplicate-payment:${b.order.id}` }));
  });

  it("a free order only sends an SMS to a verified phone", async () => {
    const c = await coupon({ code: "ALLFREE", value: 100 });
    const verified = await db.user.create({ data: { name: "V", email: `v-${stamp}@example.com`, emailVerified: true, phoneNumber: `+2547${String(stamp).slice(-6)}91`, phoneNumberVerified: true } });
    const unverified = await db.user.create({ data: { name: "U", email: `u-${stamp}@example.com`, emailVerified: false, phoneNumber: `+2547${String(stamp).slice(-6)}92`, phoneNumberVerified: false } });
    made.users.add(verified.id);
    made.users.add(unverified.id);
    const e = await edition("300.00");
    const e2 = await edition("300.00");
    const a = await createPendingOrder({ userId: unverified.id, editionIds: [e.id], coupon: c.code });
    await db.$transaction((tx) => markOrderPaid(a.order.id, {}, tx));
    await afterOrderPaid(a.order.id);
    expect(mocks.sendSms).not.toHaveBeenCalled();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    const b = await createPendingOrder({ userId: verified.id, editionIds: [e2.id], coupon: c.code });
    await db.$transaction((tx) => markOrderPaid(b.order.id, {}, tx));
    await afterOrderPaid(b.order.id);
    expect(mocks.sendSms).toHaveBeenCalledTimes(1);
  });

  it("a paid guest order gets an invoice number and PDF, an email with it attached, and an SMS of 150 characters or fewer", async () => {
    const e = await edition("1000.00");
    const c = await coupon({ code: "HALF", value: 50 });
    const buyer = await resolveBuyer(details(4));
    made.users.add(buyer.userId);
    const claim = newClaimToken();
    const { order, total } = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], provider: "PAYSTACK", coupon: c.code, claimTokenHash: claim.hash, accountCreated: true, payerPhone: buyer.phone ?? undefined });
    expect(total).toBe(500);
    expect(Number(order.discountAmount)).toBe(500);
    expect(order.claimTokenHash).toBe(hashToken(claim.token));

    expect(await db.$transaction((tx) => markOrderPaid(order.id, { provider: "PAYSTACK" }, tx))).toBe(true);
    expect(await db.$transaction((tx) => markOrderPaid(order.id, { provider: "PAYSTACK" }, tx))).toBe(false); // exactly once

    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    expect((await db.coupon.findUniqueOrThrow({ where: { id: c.id } })).timesRedeemed).toBe(1);
    expect(await db.entitlement.count({ where: { userId: buyer.userId } })).toBe(1);

    const invoice = await invoiceForOrder(order.id, { full: true });
    expect(Buffer.from(invoice!.bytes).subarray(0, 5).toString()).toBe("%PDF-");
    // A device that only holds the order token never gets the account's details (it still builds a PDF).
    const masked = await invoiceForOrder(order.id, { full: false });
    expect(Buffer.from(masked!.bytes).subarray(0, 5).toString()).toBe("%PDF-");

    await afterOrderPaid(order.id);
    const email = mocks.sendEmail.mock.calls[0][0] as { to: string; attachments?: { filename: string }[] };
    expect(email.to).toBe(buyer.email);
    expect(email.attachments?.[0].filename).toBe(`${paid.invoiceNumber}.pdf`);
    // The account has no verified phone, so the welcome text goes to the number kept on the order.
    const sms = mocks.sendSms.mock.calls[0][0] as { message: string; to: string };
    expect(sms.to).toBe(buyer.phone);
    expect(sms.message.length).toBeLessThanOrEqual(150);
  });

  it("a 100% coupon makes a free order that is granted with no provider", async () => {
    const e = await edition("300.00");
    const c = await coupon({ code: "FREE", value: 100 });
    const buyer = await resolveBuyer(details(5));
    made.users.add(buyer.userId);
    const { order, total } = await createPendingOrder({ userId: buyer.userId, editionIds: [e.id], coupon: c.code });
    expect(total).toBe(0);
    expect(await db.$transaction((tx) => markOrderPaid(order.id, {}, tx))).toBe(true);
    expect(await db.entitlement.count({ where: { userId: buyer.userId } })).toBe(1);
  });
});
