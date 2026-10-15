import { env } from "@/lib/env";
import { AppError } from "@/lib/trace";

const API_VERSION = "v2025-02-19";
const REVALIDATE_SECONDS = 3600; // safety net: the Sanity webhook normally refreshes sooner

export const blogEnabled = () => Boolean(env.SANITY_PROJECT_ID);

/** One read-only GROQ query over Sanity's HTTP API. Tagged "sanity" so the webhook can refresh it. */
export async function sanityQuery<T>(query: string, params: Record<string, string> = {}): Promise<T> {
  const search = new URLSearchParams({ query });
  for (const [key, value] of Object.entries(params)) search.set(`$${key}`, JSON.stringify(value));
  // With a token the CDN cannot be used (it serves public data only).
  const host = env.SANITY_API_TOKEN ? "api" : "apicdn";
  const response = await fetch(`https://${env.SANITY_PROJECT_ID}.${host}.sanity.io/${API_VERSION}/data/query/${env.SANITY_DATASET}?${search}`, {
    headers: env.SANITY_API_TOKEN ? { authorization: `Bearer ${env.SANITY_API_TOKEN}` } : undefined,
    next: { tags: ["sanity"], revalidate: REVALIDATE_SECONDS },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new AppError("BLOG_SANITY_FAILED", "Sanity request failed.", 502, { status: response.status });
  return ((await response.json()) as { result: T }).result;
}
