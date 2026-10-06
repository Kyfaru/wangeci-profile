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

/**
 * The one way server code asks "who is signed in?". Better Auth is the only source of truth;
 * a missing cookie, an expired or revoked session, a banned user or a database error all mean
 * "nobody" (fail closed), never a guess.
 */
export async function getSession() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.banned) return null;
    void touchLastSeen(session.user.id);
    return session;
  } catch (error) {
    console.error("[session] getSession failed", error);
    return null;
  }
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
  if (!session) redirect("/sign-in");
  const { user } = session;
  const incomplete = !user.emailVerified || !user.phoneNumberVerified;
  if (incomplete && !options.allowIncomplete) redirect("/verify?step=complete");
  return user;
}

/**
 * For admin pages, route handlers and server actions. Signed in, verified, and the role must be
 * allowed to do `action` by lib/permissions.ts. Anyone else gets a 404 (do not reveal the page exists).
 */
export async function requireRole(action: Action) {
  const user = await requireUser();
  if (!can(user.role, action)) notFound();
  return user;
}
