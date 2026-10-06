import { getKv } from "@/lib/auth/kv";
import { prisma } from "@/lib/prisma";

/**
 * One active session per account, enforced on the server.
 *
 * When someone proves who they are (a correct code or a Google sign-in) while another session is
 * still valid, creating the new session is refused with SESSION_ALREADY_ACTIVE. The person can then
 * choose "sign out the other device and continue". That choice is stored here as a short-lived
 * consent keyed by their email or phone. It is safe to store without proof: it only lets a later,
 * successfully verified sign-in replace the old session. It cannot sign anyone in by itself.
 */
const CONSENT_TTL_SECONDS = 10 * 60;
const keyFor = (identifier: string) => `replace-consent:${identifier.trim().toLowerCase()}`;

export async function grantReplaceConsent(identifier: string): Promise<void> {
  await getKv().set(keyFor(identifier), true, CONSENT_TTL_SECONDS);
}

async function takeConsent(identifiers: (string | null | undefined)[]): Promise<boolean> {
  const kv = getKv();
  let granted = false;
  for (const id of identifiers) {
    if (!id) continue;
    if (await kv.get<boolean>(keyFor(id))) {
      granted = true;
      await kv.del(keyFor(id)); // single use
    }
  }
  return granted;
}

export type SessionDecision = "allow" | "replace" | "block";

/** Decide what to do when a new session is about to be created for this user. */
export async function decideNewSession(user: { id: string; email: string; phoneNumber?: string | null }): Promise<SessionDecision> {
  const active = await prisma.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } });
  if (active === 0) return "allow";
  return (await takeConsent([user.email, user.phoneNumber])) ? "replace" : "block";
}

/** Revoke every other session for the user (the old device gets a 401 on its next request). */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}
