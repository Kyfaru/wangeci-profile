import { z } from "zod";

import { getProvider } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifier";

/**
 * Every admin WRITE lives here. Each function:
 *  - takes the acting admin (already checked by requireRole in the page or server action)
 *  - requires a typed reason (refunds, complimentary access, bans, role changes, retiring a book)
 *  - writes its audit_log row in the SAME transaction as the change, so a change without a record
 *    (or a record without a change) cannot happen
 */
export class AdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminError";
  }
}

export const reasonSchema = z.string().trim().min(10, "Please write a reason of at least 10 characters.").max(500);
const reasonOrThrow = (reason: string) => {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new AdminError(parsed.error.issues[0].message);
  return parsed.data;
};

export interface Actor {
  id: string;
  ip?: string | null;
}

/**
 * Step 1 of a card refund. Records "refund.requested", marks the order as "refund pending", then asks
 * the payment provider. It NEVER marks the order REFUNDED: only the provider's signed refund event does
 * that (and removes access in the same transaction, see lib/orders/apply-event.ts). If the provider
 * refuses, the pending mark is cleared and "refund.failed" is recorded; the order stays PAID.
 */
export async function requestRefund(input: { orderId: string; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) throw new AdminError("Order not found.");
  if (order.status !== "PAID") throw new AdminError("Only a paid order can be refunded.");
  if (order.refundRequestedAt) throw new AdminError("A refund has already been requested for this order.");
  if (order.provider !== "PAYSTACK" || !order.providerReference) {
    throw new AdminError("This payment cannot be refunded automatically. Send the money back yourself, then record it as a manual refund.");
  }

  // Conditional: two clicks at once cannot both start a refund.
  const claimed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: "PAID", refundRequestedAt: null },
      data: { refundRequestedAt: new Date(), refundRequestedById: input.actor.id },
    });
    if (count === 0) return false;
    await recordAudit({ adminId: input.actor.id, action: "refund.requested", targetType: "order", targetId: order.id, meta: { reason, amount: order.totalAmount.toString(), reference: order.providerReference }, ip: input.actor.ip }, tx);
    return true;
  });
  if (!claimed) throw new AdminError("A refund has already been requested for this order.");

  try {
    const result = await getProvider(order.provider).refund({ reference: order.providerReference, amount: Number(order.totalAmount), reason });
    if (!result.ok) throw new Error("The provider did not accept the refund.");
  } catch (error) {
    const why = error instanceof Error ? error.message : "unknown error";
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { refundRequestedAt: null, refundRequestedById: null } });
      await recordAudit({ adminId: input.actor.id, action: "refund.failed", targetType: "order", targetId: order.id, meta: { reason, error: why.slice(0, 300) }, ip: input.actor.ip }, tx);
    });
    throw new AdminError("The payment provider refused the refund. The order is unchanged.");
  }
  return { ok: true };
}

/**
 * For payments that cannot be refunded automatically (M-Pesa): the owner sends the money back outside
 * this system, then records it here with the proof. This is the only place besides the signed provider
 * event that sets REFUNDED, and it needs a reason and a reference.
 */
export async function recordManualRefund(input: { orderId: string; actor: Actor; reason: string; reference: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  const reference = z.string().trim().min(4, "Enter the reference of the money you sent back.").max(80).parse(input.reference);

  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { items: { include: { edition: { include: { work: true } } } } } });
  if (!order) throw new AdminError("Order not found.");
  if (order.status !== "PAID") throw new AdminError("Only a paid order can be refunded.");
  if (order.provider === "PAYSTACK") throw new AdminError("Card payments are refunded automatically; use the Refund button.");

  const done = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "REFUNDED", refundRequestedAt: new Date(), refundRequestedById: input.actor.id } });
    if (count === 0) return false;
    await tx.entitlement.deleteMany({ where: { orderId: order.id } });
    await recordAudit({ adminId: input.actor.id, action: "refund.completed", targetType: "order", targetId: order.id, meta: { reason, manual: true, reference }, ip: input.actor.ip }, tx);
    return true;
  });
  if (!done) throw new AdminError("This order was already changed. Refresh the page.");

  await notify(order.userId, { type: "refund_completed", orderId: order.id, titles: order.items.map((i) => i.edition.title ?? i.edition.work.title) }, ["in_app"]).catch(() => {});
  return { ok: true };
}

/** Complimentary access: an entitlement with no order. It never counts as revenue. */
export async function grantComplimentaryAccess(input: { userId: string; editionId: string; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  const [user, edition] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
    prisma.edition.findUnique({ where: { id: input.editionId }, select: { id: true, format: true } }),
  ]);
  if (!user) throw new AdminError("Customer not found.");
  if (!edition || edition.format === "PAPERBACK") throw new AdminError("That edition cannot be granted.");

  await prisma.$transaction(async (tx) => {
    const existing = await tx.entitlement.findUnique({ where: { userId_editionId: { userId: user.id, editionId: edition.id } } });
    if (existing) throw new AdminError("This customer already has access to that edition.");
    const row = await tx.entitlement.create({ data: { userId: user.id, editionId: edition.id, orderId: null } });
    await recordAudit({ adminId: input.actor.id, action: "access.granted", targetType: "entitlement", targetId: row.id, meta: { reason, userId: user.id, editionId: edition.id }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

/** Removes COMPLIMENTARY access only. Access that was paid for is removed by a refund, never here. */
export async function revokeComplimentaryAccess(input: { entitlementId: string; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  await prisma.$transaction(async (tx) => {
    const row = await tx.entitlement.findUnique({ where: { id: input.entitlementId } });
    if (!row) throw new AdminError("Access not found.");
    if (row.orderId) throw new AdminError("This access was paid for. Refund the order instead.");
    await tx.entitlement.delete({ where: { id: row.id } });
    await recordAudit({ adminId: input.actor.id, action: "access.revoked", targetType: "entitlement", targetId: row.id, meta: { reason, userId: row.userId, editionId: row.editionId }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

/** Ban or unban a customer. A ban ends all their sessions at once. Admins cannot be banned here. */
export async function setBan(input: { userId: string; banned: boolean; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  if (input.userId === input.actor.id) throw new AdminError("You cannot ban yourself.");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true } });
    if (!user) throw new AdminError("Customer not found.");
    if (input.banned && user.role !== "reader") throw new AdminError("Change this person's role to reader before banning them.");
    await tx.user.update({ where: { id: user.id }, data: { banned: input.banned, banReason: input.banned ? reason : null, banExpires: null } });
    if (input.banned) await tx.session.deleteMany({ where: { userId: user.id } });
    await recordAudit({ adminId: input.actor.id, action: input.banned ? "customer.banned" : "customer.unbanned", targetType: "user", targetId: user.id, meta: { reason }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

export const ASSIGNABLE_ROLES = ["support", "editor", "reader"] as const;

/**
 * Owner-only role change. The owner role itself is never assigned here (the first owner comes from the
 * seeded allowlist), and a role change ends the person's sessions so the new rights apply at once.
 */
export async function setRole(input: { userId: string; role: (typeof ASSIGNABLE_ROLES)[number]; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new AdminError("That role cannot be assigned here.");
  if (input.userId === input.actor.id) throw new AdminError("You cannot change your own role.");
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true } });
    if (!user) throw new AdminError("User not found.");
    if (user.role === "owner") throw new AdminError("The owner role cannot be changed here.");
    await tx.user.update({ where: { id: user.id }, data: { role: input.role } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await recordAudit({ adminId: input.actor.id, action: "role.changed", targetType: "user", targetId: user.id, meta: { reason, from: user.role, to: input.role }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

/** Create a discount code. Codes are stored upper-case; a percent is 1 to 100. */
export async function createCoupon(input: { actor: Actor; reason: string; code: string; type: "PERCENT" | "FIXED"; value: number; minSubtotal?: number | null; maxRedemptions?: number | null; endsAt?: Date | null }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw new AdminError("A code is 3 to 30 letters, numbers, - or _.");
  if (!(input.value > 0)) throw new AdminError("The value must be more than zero.");
  if (input.type === "PERCENT" && input.value > 100) throw new AdminError("A percentage cannot be more than 100.");
  await prisma.$transaction(async (tx) => {
    if (await tx.coupon.findUnique({ where: { code } })) throw new AdminError("That code already exists.");
    const row = await tx.coupon.create({ data: { code, type: input.type, value: input.value.toFixed(2), minSubtotal: input.minSubtotal ?? null, maxRedemptions: input.maxRedemptions ?? null, endsAt: input.endsAt ?? null } });
    await recordAudit({ adminId: input.actor.id, action: "coupon.created", targetType: "coupon", targetId: row.id, meta: { reason, code, type: input.type, value: input.value }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

/** Switch a code on or off. Used codes stay on their orders either way. */
export async function setCouponActive(input: { couponId: string; active: boolean; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  await prisma.$transaction(async (tx) => {
    const row = await tx.coupon.findUnique({ where: { id: input.couponId } });
    if (!row) throw new AdminError("Coupon not found.");
    await tx.coupon.update({ where: { id: row.id }, data: { isActive: input.active } });
    await recordAudit({ adminId: input.actor.id, action: input.active ? "coupon.enabled" : "coupon.disabled", targetType: "coupon", targetId: row.id, meta: { reason, code: row.code }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}

/** Publish or retire an edition. Retiring never deletes: orders and owners keep their access. */
export async function setEditionActive(input: { editionId: string; active: boolean; actor: Actor; reason: string }): Promise<{ ok: true }> {
  const reason = reasonOrThrow(input.reason);
  await prisma.$transaction(async (tx) => {
    const edition = await tx.edition.findUnique({ where: { id: input.editionId }, include: { _count: { select: { chapters: true } } } });
    if (!edition) throw new AdminError("Edition not found.");
    if (input.active && edition._count.chapters === 0) throw new AdminError("Add chapters before publishing this edition.");
    await tx.edition.update({ where: { id: edition.id }, data: { isActive: input.active } });
    await recordAudit({ adminId: input.actor.id, action: input.active ? "edition.published" : "edition.retired", targetType: "edition", targetId: edition.id, meta: { reason }, ip: input.actor.ip }, tx);
  });
  return { ok: true };
}
