import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getKv } from "@/lib/auth/kv";
import { can, type Action } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const LAST_SEEN_EVERY_SECONDS = 5 * 60;

/** Updates user.lastSeenAt at most once every 5 minutes (never on every request). */
async function touchLastSeen(userId: string) {
  try {
    const kv = getKv();
    const key = `seen:${userId}`;
    if (await kv.get(key)) return;
    await kv.set(key, 1, LAST_SEEN_EVERY_SECONDS);
    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  } catch (error) {
    console.error("[session] lastSeenAt update failed", error);
  }
}

/** The session exactly as Better Auth sees it, before our extra rules (two-step). Use getSession() for anything that matters. */
async function getRawSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return !session || session.user.banned ? null : session;
  } catch (error) {
    console.error("[session] getSession failed", error);
    return null;
  }
}

/** Two-step is on for this account, but this session has not entered its authenticator code yet. */
const pendingTwoFactor = (s: NonNullable<Awaited<ReturnType<typeof getRawSession>>>) => Boolean(s.user.twoFactorEnabled) && !s.session.twoFactorVerifiedAt;

/**
 * The one way server code asks "who is signed in?". Better Auth is the only source of truth;
 * a missing cookie, an expired or revoked session, a banned user, a session still waiting for the
 * two-step code, or a database error all mean "nobody" (fail closed), never a guess.
 */
export async function getSession() {
  const session = await getRawSession();
  if (!session || pendingTwoFactor(session)) return null;
  void touchLastSeen(session.user.id);
  return session;
}

/** True when someone is signed in but still owes the authenticator code (so pages can send them to enter it). */
export async function hasPendingTwoFactor(): Promise<boolean> {
  const session = await getRawSession();
  return Boolean(session && pendingTwoFactor(session));
}

/** For route handlers: the signed-in user's id, or null. */
export async function getSessionUserId(): Promise<string | null> {
  return (await getSession())?.user.id ?? null;
}

/**
 * For pages, layouts and server actions: returns the user, or redirects to sign-in.
 * A reader must also have verified both email and phone (see /verify); anyone who has not is sent
 * there to finish. Pass { allowIncomplete: true } on the verify pages themselves.
 */
export async function requireUser(options: { allowIncomplete?: boolean } = {}) {
  const session = await getSession();
  if (!session) redirect((await hasPendingTwoFactor()) ? "/verify?step=2fa" : "/sign-in");
  const { user } = session;
  const incomplete = !user.emailVerified || !user.phoneNumberVerified;
  if (incomplete && !options.allowIncomplete) redirect("/verify?step=complete");
  return user;
}

/** Admin sessions are short: after this long since sign-in, the person must sign in again. */
export const ADMIN_SESSION_MAX_MS = 8 * 60 * 60 * 1000;

export type AdminCheck =
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getSession>>>["user"] }
  | { ok: false; reason: "signed-out" | "pending-2fa" | "forbidden" | "needs-2fa" | "expired" };

/**
 * The admin gate, without redirects (route handlers use this and answer with a status code).
 * Checks, in order: a real session; the role may do `action` (lib/permissions.ts, the only place that
 * says who may do what); the account has finished two-step setup (an account with two-step on can only
 * hold a session after entering its authenticator code, so this proves it); the session is under 8 hours old.
 */
export async function checkAdmin(action: Action): Promise<AdminCheck> {
  const session = await getSession();
  if (!session) return { ok: false, reason: (await hasPendingTwoFactor()) ? "pending-2fa" : "signed-out" };
  const { user } = session;
  if (!can(user.role, action)) return { ok: false, reason: "forbidden" };
  if (!user.twoFactorEnabled) return { ok: false, reason: "needs-2fa" };
  if (Date.now() - new Date(session.session.createdAt).getTime() > ADMIN_SESSION_MAX_MS) {
    await prisma.session.deleteMany({ where: { id: session.session.id } });
    return { ok: false, reason: "expired" };
  }
  return { ok: true, user };
}

/**
 * For admin pages and server actions. Anyone who may not be here gets a 404 (do not reveal the page
 * exists); an admin without two-step is sent to set it up; an expired session goes to sign-in.
 */
export async function requireRole(action: Action) {
  const check = await checkAdmin(action);
  if (check.ok) return check.user;
  if (check.reason === "needs-2fa") redirect("/dashboard/settings?need2fa=1");
  if (check.reason === "pending-2fa") redirect("/verify?step=2fa&redirect=/admin");
  if (check.reason === "signed-out" || check.reason === "expired") redirect("/sign-in?redirect=/admin");
  notFound();
}
