"use server";

import { revalidatePath } from "next/cache";
import { logError } from "@/lib/trace";
import { headers } from "next/headers";
import { z } from "zod";

import {
  AdminError,
  ASSIGNABLE_ROLES,
  COMMENT_STATUSES,
  createCoupon,
  grantComplimentaryAccess,
  moderateComment,
  recordManualRefund,
  replyToComment,
  requestRefund,
  revokeComplimentaryAccess,
  setBan,
  setAdminEmailAlerts,
  setCouponActive,
  setFeedbackStatus,
  setEditionActive,
  setRole,
  type Actor,
} from "@/lib/admin/actions";
import { hasFreshStepUp, STEP_UP_ADMIN_MS } from "@/lib/auth/guards";
import type { Action } from "@/lib/permissions";
import { clientIp } from "@/lib/rate-limit";
import { checkAdmin } from "@/lib/server/session";

export interface ActionResult {
  ok: boolean;
  message: string;
  /** True when the action was refused only because a fresh email code is needed (show the code prompt). */
  stepUp?: boolean;
}

/** Actions that move money or change who may do what need an email code entered this recently. */
const STEP_UP_ACTIONS: Action[] = ["order.refund", "roles.manage"];

/**
 * Every admin server action starts here: the admin gate runs AGAIN on the server (a hidden button is
 * not security), the permission for THIS action is checked, then the change runs and is audited.
 */
async function run(permission: Action, change: (actor: Actor) => Promise<string>): Promise<ActionResult> {
  const check = await checkAdmin(permission);
  if (!check.ok) return { ok: false, message: "You are not allowed to do that." };
  if (STEP_UP_ACTIONS.includes(permission) && !(await hasFreshStepUp(check.user.id, STEP_UP_ADMIN_MS))) {
    return { ok: false, stepUp: true, message: "Please confirm it is you: request and enter a fresh email code, then try again." };
  }
  const ip = clientIp(await headers());
  try {
    const message = await change({ id: check.user.id, ip });
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Please check the form." };
    logError(`admin.${permission}`, error, { adminId: check.user.id });
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const num = (form: FormData, key: string) => (text(form, key).trim() === "" ? null : Number(text(form, key)));

export async function createCouponAction(_prev: ActionResult | null, form: FormData) {
  return run("coupon.manage", async (actor) => {
    const ends = text(form, "endsAt");
    await createCoupon({
      actor,
      reason: text(form, "reason"),
      code: text(form, "code"),
      type: text(form, "type") === "FIXED" ? "FIXED" : "PERCENT",
      value: Number(text(form, "value")),
      minSubtotal: num(form, "minSubtotal"),
      maxRedemptions: num(form, "maxRedemptions"),
      endsAt: ends ? new Date(`${ends}T23:59:59Z`) : null,
    });
    return "Coupon created.";
  });
}

export async function setCouponActiveAction(_prev: ActionResult | null, form: FormData) {
  return run("coupon.manage", async (actor) => {
    await setCouponActive({ couponId: text(form, "couponId"), active: text(form, "active") === "true", actor, reason: text(form, "reason") });
    return "Coupon updated.";
  });
}

export async function refundOrderAction(_prev: ActionResult | null, form: FormData) {
  return run("order.refund", async (actor) => {
    await requestRefund({ orderId: text(form, "orderId"), actor, reason: text(form, "reason") });
    return "Refund requested. The order changes to refunded when the payment provider confirms it.";
  });
}

export async function manualRefundAction(_prev: ActionResult | null, form: FormData) {
  return run("order.refund", async (actor) => {
    await recordManualRefund({ orderId: text(form, "orderId"), actor, reason: text(form, "reason"), reference: text(form, "reference") });
    return "Manual refund recorded and access removed.";
  });
}

export async function grantAccessAction(_prev: ActionResult | null, form: FormData) {
  return run("access.grant", async (actor) => {
    await grantComplimentaryAccess({ userId: text(form, "userId"), editionId: text(form, "editionId"), actor, reason: text(form, "reason") });
    return "Complimentary access granted.";
  });
}

export async function revokeAccessAction(_prev: ActionResult | null, form: FormData) {
  return run("access.revoke", async (actor) => {
    await revokeComplimentaryAccess({ entitlementId: text(form, "entitlementId"), actor, reason: text(form, "reason") });
    return "Access removed.";
  });
}

export async function banAction(_prev: ActionResult | null, form: FormData) {
  return run("customer.ban", async (actor) => {
    const banned = text(form, "banned") === "true";
    await setBan({ userId: text(form, "userId"), banned, actor, reason: text(form, "reason") });
    return banned ? "Customer banned and signed out everywhere." : "Customer unbanned.";
  });
}

export async function roleAction(_prev: ActionResult | null, form: FormData) {
  return run("roles.manage", async (actor) => {
    const role = z.enum(ASSIGNABLE_ROLES).parse(text(form, "role"));
    await setRole({ userId: text(form, "userId"), role, actor, reason: text(form, "reason") });
    return "Role changed. The person was signed out so it applies at once.";
  });
}

export async function editionActiveAction(_prev: ActionResult | null, form: FormData) {
  return run("content.manage", async (actor) => {
    const active = text(form, "active") === "true";
    await setEditionActive({ editionId: text(form, "editionId"), active, actor, reason: text(form, "reason") });
    return active ? "Edition published." : "Edition retired. Owners keep their access.";
  });
}

export async function moderateCommentAction(_prev: ActionResult | null, form: FormData) {
  return run("comments.moderate", async (actor) => {
    const status = z.enum(COMMENT_STATUSES).parse(text(form, "status"));
    await moderateComment({ commentId: text(form, "commentId"), status, actor, reason: text(form, "reason") });
    return "Comment updated.";
  });
}

export async function replyToCommentAction(_prev: ActionResult | null, form: FormData) {
  return run("comments.moderate", async (actor) => {
    await replyToComment({ commentId: text(form, "commentId"), body: text(form, "body"), actor });
    return "Reply posted.";
  });
}

export async function feedbackStatusAction(_prev: ActionResult | null, form: FormData) {
  return run("comments.moderate", async (actor) => {
    const status = z.enum(["READ", "ACTIONED"]).parse(text(form, "status"));
    await setFeedbackStatus({ feedbackId: text(form, "feedbackId"), status, actor });
    return "Feedback updated.";
  });
}

export async function emailAlertsAction(_prev: ActionResult | null, form: FormData) {
  return run("messages.reply", async (actor) => {
    await setAdminEmailAlerts({ actor, enabled: text(form, "enabled") === "true" });
    return "Saved.";
  });
}

