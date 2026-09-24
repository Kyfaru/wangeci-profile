/**
 * The dashboard, per the build plan, renders as an always-accessible
 * "mock-logged-in" experience — no real auth gating/redirect-to-login (see
 * plan §9's open-question default). The mock `app/api/**` routes (e.g.
 * `GET /api/user/library`) DO enforce a session cookie via
 * `lib/server/mock-auth.ts`, but nothing in this build sets that cookie
 * automatically (that only happens by exercising the login flow).
 *
 * Rather than round-tripping through those session-gated routes from a
 * server component (which would 401 without a cookie the dashboard never
 * sets), these pages follow the same convention as
 * `app/(marketing)/store/[slug]/page.tsx`: read the `lib/mock-*` fixtures
 * directly, server-side, scoped to a fixed demo user. `usr_1` is the only
 * seed user with meaningful library/notification/activity/bookmark data
 * (see lib/mock-user.ts's header comment), so it's the natural choice.
 */
export const CURRENT_USER_ID = "usr_1";
