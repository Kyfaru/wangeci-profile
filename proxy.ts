import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

// Route prefixes that require a signed-in session. Add new protected
// sections here — and mirror the change in `config.matcher` below, since
// Next.js requires matcher values to be static string literals (not derived
// from this array) for build-time analysis.
const PROTECTED_PREFIXES = ["/my-books", "/account"];

/**
 * Redirects unauthenticated requests away from protected routes.
 * Why it exists: this is an optimistic, cookie-only check (no DB lookup) —
 * Proxy runs on every matched request including prefetches, so it must stay
 * fast. It only proves "a session cookie is present," not that the session
 * is still valid; real authorization happens server-side per route (see
 * Next.js's data-security guidance on not relying on Proxy alone).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Keep in sync with PROTECTED_PREFIXES above.
  matcher: ["/my-books/:path*", "/account/:path*"],
};
