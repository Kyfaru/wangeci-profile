/**
 * Only allow redirects to a path on our own site. An open redirect would let an attacker send a
 * user through our sign-in and land them on a fake site. Anything unsafe returns the fallback.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/dashboard/books"): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback; // absolute URLs, javascript:, mailto:...
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback; // protocol-relative
  if (/[\u0000-\u001f\\]/.test(target)) return fallback; // control characters, backslashes
  try {
    const url = new URL(target, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }
  return target;
}
