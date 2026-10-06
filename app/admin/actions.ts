"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import {
  AdminError,
  ASSIGNABLE_ROLES,
  grantComplimentaryAccess,
  recordManualRefund,
  requestRefund,
  revokeComplimentaryAccess,
  setBan,
  setEditionActive,
  setRole,
  type Actor,
} from "@/lib/admin/actions";
import type { Action } from "@/lib/permissions";
import { checkAdmin } from "@/lib/server/session";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/**
 * Every admin server action starts here: the admin gate runs AGAIN on the server (a hidden button is
 * not security), the permission for THIS action is checked, then the change runs and is audited.
 */
async function run(permission: Action, change: (actor: Actor) => Promise<string>): Promise<ActionResult> {
  const check = await checkAdmin(permission);
  if (!check.ok) return { ok: false, message: "You are not allowed to do that." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  try {
    const message = await change({ id: check.user.id, ip });
    revalidatePath("/admin", "layout");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Please check the form." };
    console.error("[admin action] failed", error);
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

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
