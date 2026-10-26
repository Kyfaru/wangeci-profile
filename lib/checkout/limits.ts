import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/trace";

/** Counts one hit on `key` and throws a 429 AppError (CHECKOUT_RATE_LIMITED) once `limit` is passed in `window`. */
export async function limitOrThrow(key: string, limit: number, window: Parameters<typeof rateLimit>[2], message = "Too many attempts. Please try again later.") {
  const result = await rateLimit(key, limit, window);
  if (!result.ok) throw new AppError("CHECKOUT_RATE_LIMITED", message, 429, { retryAfterSeconds: result.retryAfter });
}
