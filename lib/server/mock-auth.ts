import { cookies } from "next/headers";

/**
 * MOCK auth-cookie helpers — server-only.
 *
 * This is intentionally NOT real authentication: the "token" is just
 * base64-encoded JSON with no signature, no expiry enforcement beyond the
 * cookie's own maxAge, and no encryption. It exists purely so /dashboard and
 * similar routes can gate realistically during local UI development.
 *
 * Real auth (Better Auth, signed/encrypted sessions, password hashing) is
 * the backend session's responsibility and will replace this wholesale —
 * nothing here should be treated as a security boundary.
 */

export const SESSION_COOKIE_NAME = "wangeci_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface MockSessionPayload {
  userId: string;
  issuedAt: number;
}

export function encodeMockSessionToken(payload: MockSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decodeMockSessionToken(
  token: string | undefined | null
): MockSessionPayload | null {
  if (!token) return null;
  try {
    const json = Buffer.from(token, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<MockSessionPayload>;
    if (typeof parsed.userId !== "string") return null;
    return { userId: parsed.userId, issuedAt: parsed.issuedAt ?? 0 };
  } catch {
    return null;
  }
}

/** Reads the mock session cookie for the current request and returns the
 * logged-in user's id, or null if there isn't one / it's invalid. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return decodeMockSessionToken(token)?.userId ?? null;
}
