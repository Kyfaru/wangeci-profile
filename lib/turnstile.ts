import { env } from "@/lib/env";
import { isRelaxed } from "@/lib/site";
import { logError } from "@/lib/trace";

/**
 * Checks a Cloudflare Turnstile token on the server. With no secret configured (local development
 * only; env.ts requires it in production) the check is skipped.
 */
export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return isRelaxed(); // skipped only in development/test or declared staging
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, ...(ip && ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    logError("turnstile.verify", error);
    return false; // fail closed
  }
}
