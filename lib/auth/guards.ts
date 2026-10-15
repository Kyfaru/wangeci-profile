import { getKv, type Kv } from "@/lib/auth/kv";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/trace";

/**
 * Small abuse guards for the auth endpoints, all on the shared key-value store (lib/auth/kv.ts).
 * Each takes an optional `store` so tests can pass an in-memory one.
 */
const kvOf = (store?: Kv) => store ?? getKv();

// ---- Step-up: "the person at the keyboard just proved the mailbox again" -----------------------------------

/** Sensitive account changes (two-step settings) need an email code proved this recently. */
export const STEP_UP_ACCOUNT_MS = 5 * 60_000;
/** Money and role changes in the admin need one proved this recently. */
export const STEP_UP_ADMIN_MS = 10 * 60_000;
const STEP_UP_TTL_SECONDS = 60 * 60;

/** Record that this user has just entered a correct email code. */
export async function markStepUp(userId: string, store?: Kv, now = Date.now()): Promise<void> {
  await kvOf(store).set(`stepup:${userId}`, now, STEP_UP_TTL_SECONDS);
}

/** True when the user entered a correct email code no longer than `maxAgeMs` ago. */
export async function hasFreshStepUp(userId: string, maxAgeMs: number, store?: Kv, now = Date.now()): Promise<boolean> {
  const at = await kvOf(store).get<number>(`stepup:${userId}`);
  return typeof at === "number" && now - at <= maxAgeMs;
}

// ---- First proof of an email: nothing the account gathered before that may survive ---------------------------

const UNPROVEN_TTL_SECONDS = 10 * 60;

/** Before a code check: remember that this email's account has never proven its mailbox. */
export async function markUnproven(email: string, store?: Kv, now = Date.now()): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { emailVerified: true } });
  if (user && !user.emailVerified) await kvOf(store).set(`unproven:${email}`, now, UNPROVEN_TTL_SECONDS);
}

/**
 * After a correct code on an account marked by markUnproven: the real mailbox owner has arrived, so drop what
 * a stranger could have attached before them. The unverified phone (a sign-in factor nobody proved) is
 * cleared and every session older than this request is revoked. Returns true when it ran.
 */
export async function settleFirstProof(email: string, store?: Kv): Promise<boolean> {
  const kv = kvOf(store);
  const since = await kv.get<number>(`unproven:${email}`);
  if (typeof since !== "number") return false;
  await kv.del(`unproven:${email}`);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return false;
  await prisma.user.updateMany({ where: { id: user.id, phoneNumberVerified: false, phoneNumber: { not: null } }, data: { phoneNumber: null } });
  await prisma.session.deleteMany({ where: { userId: user.id, createdAt: { lt: new Date(since) } } });
  return true;
}

// ---- SMS pumping: where texts may go, and how many we send a day --------------------------------------------

/** Country prefixes we will text (SMS_ALLOWED_COUNTRY_CODES, comma separated, default Kenya only). */
export function allowedSmsPrefixes(): string[] {
  return (process.env.SMS_ALLOWED_COUNTRY_CODES ?? "+254")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export const isSmsCountryAllowed = (phone: string) => allowedSmsPrefixes().some((prefix) => phone.startsWith(prefix));

/** Daily number of code texts that makes someone look (SMS_DAILY_ALERT, default 300). */
const smsDailyAlert = () => Number(process.env.SMS_DAILY_ALERT) || 300;

/**
 * Counts one code text against today's global total and raises an alert (once, on the crossing) when the
 * total reaches the threshold. Fraud shows up as a sudden climb here long before the SMS bill arrives.
 * Returns today's count. Read-then-write is not atomic; an off-by-a-few count is fine for an alarm.
 */
export async function countSmsToday(store?: Kv, now = new Date()): Promise<number> {
  const kv = kvOf(store);
  const key = `sms-day:${now.toISOString().slice(0, 10)}`;
  const count = ((await kv.get<number>(key)) ?? 0) + 1;
  await kv.set(key, count, 48 * 3600);
  if (count === smsDailyAlert()) logError("auth.sms-daily-threshold", new Error(`SMS code sends reached ${count} today`), { count });
  return count;
}

// ---- Authenticator code guessing -----------------------------------------------------------------------------

/** Wrong authenticator or backup codes allowed before the session is thrown away. */
export const TOTP_MAX_FAILURES = 5;
/** How long the authenticator step stays locked after that. */
export const TOTP_LOCK_SECONDS = 5 * 60;

/** Seconds the user's authenticator step is locked for (0 = free). */
export async function totpLockedFor(userId: string, store?: Kv, now = Date.now()): Promise<number> {
  const until = await kvOf(store).get<number>(`totp-lock:${userId}`);
  return typeof until === "number" && until > now ? Math.ceil((until - now) / 1000) : 0;
}

/** Records a wrong code. Returns true when this one reached the limit (the caller must end the session). */
export async function recordTotpFailure(userId: string, store?: Kv, now = Date.now()): Promise<boolean> {
  const kv = kvOf(store);
  const count = ((await kv.get<number>(`totp-fail:${userId}`)) ?? 0) + 1;
  if (count < TOTP_MAX_FAILURES) {
    await kv.set(`totp-fail:${userId}`, count, TOTP_LOCK_SECONDS * 2);
    return false;
  }
  await kv.del(`totp-fail:${userId}`);
  await kv.set(`totp-lock:${userId}`, now + TOTP_LOCK_SECONDS * 1000, TOTP_LOCK_SECONDS);
  return true;
}

export async function clearTotpFailures(userId: string, store?: Kv): Promise<void> {
  await kvOf(store).del(`totp-fail:${userId}`);
}

