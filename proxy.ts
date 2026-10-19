import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

// Route prefixes that require a signed-in session. This is only the fast front
// door (cookie present, no database lookup): every protected page, route
// handler and server action must re-check the real session on the server.
const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy. REPORT-ONLY for now: it logs violations in the browser console
// without blocking anything. Flip it to enforcing after a staging pass with the browser console open (see docs/GO_LIVE.md).
// Origins of the optional third-party services, added only when they are configured.
const originOf = (url?: string) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};
const umamiOrigin = process.env.UMAMI_WEBSITE_ID ? originOf(process.env.UMAMI_SCRIPT_URL || "https://cloud.umami.is/script.js") : "";
const chatwootOrigin = process.env.CHATWOOT_WEBSITE_TOKEN ? originOf(process.env.CHATWOOT_BASE_URL) : "";
const chatwootSocket = chatwootOrigin.replace(/^http/, "ws");

function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""} ${umamiOrigin} ${chatwootOrigin}`.trim(),
    "style-src 'self' 'unsafe-inline'", // inline style attributes (React, motion) cannot carry a nonce
    "img-src 'self' data: blob: https://*.r2.dev",
    "font-src 'self' data:",
    "media-src 'self' blob: https://*.r2.cloudflarestorage.com",
    `connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com https://challenges.cloudflare.com https://checkout.paystack.com https://api.paystack.co ${umamiOrigin} ${chatwootOrigin} ${chatwootSocket}`.replace(/ +/g, " ").trim(),
    `frame-src https://challenges.cloudflare.com https://checkout.paystack.com ${chatwootOrigin}`.trim(), // Turnstile widget, Paystack card popup, Chatwoot
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !getSessionCookie(request)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy-Report-Only", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", csp);

  // Random per-browser id, issued by the server. A device hint for the one-session rule, not a
  // fingerprint, and never a security control on its own.
  if (!request.cookies.get("device_id")) {
    response.cookies.set("device_id", crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: !isDev,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, Next internals and static files, and skip prefetches.
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
