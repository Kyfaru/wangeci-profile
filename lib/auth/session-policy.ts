import { createHash, randomBytes } from "node:crypto";

import { getKv } from "@/lib/auth/kv";
import { prisma } from "@/lib/prisma";

/**
 * One active session per account, enforced on the server.
 *
 * When someone proves who they are (a correct code or a Google sign-in) while another session is
 * still valid, creating the new session is refused with SESSION_ALREADY_ACTIVE. That refusal carries a
 * one-time `replaceToken`, which only a person who just passed a real code check can have. Sending the
 * token back (grantReplaceConsent) records a short-lived consent to replace the other device on the NEXT
 * verified sign-in. Without the token nothing can be pre-granted for someone else's account.
 */
const CONSENT_TTL_SECONDS = 10 * 60;
const consentKey = (userId: string) => `replace-consent:${userId}`;
const tokenKey = (token: string) => `replace-token:${createHash("sha256").update(token).digest("hex")}`;

/** Called when a verified sign-in is refused because another session is active. Returns the token to hand back to that person. */
async function createReplaceToken(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await getKv().set(tokenKey(token), userId, CONSENT_TTL_SECONDS);
  return token;
}

/**
 * Records consent to replace the other device. Needs the token from the refusal AND the identifier (email
 * or phone) of the same account. Returns false for a wrong, expired or reused token (it is single use).
 */
export async function grantReplaceConsent(identifier: string, token: string): Promise<boolean> {
  const kv = getKv();
  const userId = await kv.get<string>(tokenKey(token));
  if (!userId) return false;
  const id = identifier.trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { OR: [{ email: id }, { phoneNumber: identifier.trim() }] }, select: { id: true } });
  if (!user || user.id !== userId) return false;
  await kv.del(tokenKey(token));
  await kv.set(consentKey(userId), true, CONSENT_TTL_SECONDS);
  return true;
}

async function takeConsent(userId: string): Promise<boolean> {
  const kv = getKv();
  if (!(await kv.get<boolean>(consentKey(userId)))) return false;
  await kv.del(consentKey(userId)); // single use
  return true;
}

export type SessionDecision = "allow" | "replace" | { block: { replaceToken: string } };

/** Decide what to do when a new session is about to be created for this user. */
export async function decideNewSession(user: { id: string }): Promise<SessionDecision> {
  const active = await prisma.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } });
  if (active === 0) return "allow";
  if (await takeConsent(user.id)) return "replace";
  return { block: { replaceToken: await createReplaceToken(user.id) } };
}

/** Revoke every other session for the user (the old device gets a 401 on its next request). */
export async function revokeOtherSessions(userId: string): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { userId } });
  return count;
}
