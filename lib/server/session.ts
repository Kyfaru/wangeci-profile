import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * The one way server code asks "who is signed in?". Better Auth is the only
 * source of truth; a missing cookie, an expired session or a database error
 * all mean "nobody" (fail closed), never a guess.
 */
export async function getSession() {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    console.error("[session] getSession failed", error);
    return null;
  }
}

/** For route handlers: the signed-in user's id, or null. */
export async function getSessionUserId(): Promise<string | null> {
  return (await getSession())?.user.id ?? null;
}

/** For pages and layouts: returns the user, or redirects to sign-in. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
