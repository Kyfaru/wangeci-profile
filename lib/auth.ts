import { betterAuth } from "better-auth";
import { createElement } from "react";
import AdminAlertEmail from "@/emails/admin-alert-email";
import { sendEmail } from "@/lib/email";
import { logError, traced } from "@/lib/trace";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, captcha, emailOTP, phoneNumber, twoFactor } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

import { checkoutClaim } from "@/lib/auth/checkout-claim-plugin";
import { OTP_ATTEMPTS_PER_CODE, OTP_LENGTH, OTP_TTL_SECONDS } from "@/lib/auth/constants";
import {
  clearTotpFailures,
  countSmsToday,
  hasFreshStepUp,
  isSmsCountryAllowed,
  markStepUp,
  markUnproven,
  recordTotpFailure,
  settleFirstProof,
  STEP_UP_ACCOUNT_MS,
  totpLockedFor,
} from "@/lib/auth/guards";
import { createLadder } from "@/lib/auth/otp-ladder";
import { decideNewSession, revokeOtherSessions } from "@/lib/auth/session-policy";
import { env } from "@/lib/env";
import { isE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { dispatchOtp } from "@/lib/queue";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/server/activity";

// Origins that may call the auth endpoints: the app's own base URL, any extra domains from
// TRUSTED_ORIGINS (for example staging), and localhost only in development.
const TRUSTED_ORIGINS = [
  env.BETTER_AUTH_URL,
  ...(env.TRUSTED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
  ...(env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
];

// Endpoints that send a code, and endpoints that check one. Names come from Better Auth's
// emailOTP and phoneNumber plugins (verified in node_modules/better-auth/dist/plugins).
const SEND_PATHS = ["/email-otp/send-verification-otp", "/phone-number/send-otp"];
const VERIFY_PATHS = ["/sign-in/email-otp", "/email-otp/verify-email", "/phone-number/verify"];
const CAPTCHA_PATHS = SEND_PATHS;
const TWO_FACTOR_VERIFY_PATHS = ["/two-factor/verify-totp", "/two-factor/verify-backup-code", "/two-factor/verify-otp"];
// Changing two-step settings, or reading its secrets, needs an email code entered in the last 5 minutes.
const TWO_FACTOR_SETTINGS_PATHS = ["/two-factor/enable", "/two-factor/disable", "/two-factor/generate-backup-codes", "/two-factor/get-totp-uri"];
// Roles for which two-step is mandatory: they can never switch it off.
const TWO_FACTOR_MANDATORY_ROLES = ["owner", "support", "editor"];
// Paths where a correct email code proves the person holds the mailbox right now.
const EMAIL_PROOF_PATHS = ["/sign-in/email-otp", "/email-otp/verify-email"];

const ladder = createLadder();

// Better Auth requires every role named in adminRoles to be defined. Only "owner" may use Better
// Auth's own admin endpoints (list users, ban, revoke sessions). What each role may do in OUR admin
// screens is decided separately by lib/permissions.ts.
const ac = createAccessControl(defaultStatements);
const roles = {
  owner: ac.newRole(adminAc.statements),
  support: ac.newRole({ user: [], session: [] }),
  editor: ac.newRole({ user: [], session: [] }),
  reader: ac.newRole({ user: [], session: [] }),
};

/** Email or phone this request is about, normalised so lockouts cannot be dodged by changing case. */
function identifierFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { email?: unknown; phoneNumber?: unknown };
  if (typeof b.email === "string" && b.email) return b.email.trim().toLowerCase();
  if (typeof b.phoneNumber === "string" && b.phoneNumber) return b.phoneNumber.trim();
  return null;
}

const ipOf = (headers: Headers | undefined) => (headers ? clientIp(headers) : "unknown");

function readCookie(headers: Headers | undefined, name: string): string | null {
  const raw = headers?.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** The first owner is created only through ADMIN_EMAIL_ALLOWLIST, and only while no owner exists. */
async function bootstrapOwner(user: { id: string; email: string }) {
  const allowed = env.ADMIN_EMAIL_ALLOWLIST.split(",").map((e) => e.trim().toLowerCase());
  if (!allowed.includes(user.email.toLowerCase())) return;
  const owner = await prisma.user.findFirst({ where: { role: "owner" }, select: { id: true } });
  if (owner) return;
  await prisma.user.update({ where: { id: user.id }, data: { role: "owner" } });
  await logActivity({ userId: user.id, type: "owner.bootstrapped" });
}

/** An admin signing in from a device never seen for them gets an email (someone else may be using their code). Never blocks sign-in. */
async function alertNewAdminDevice(userId: string, deviceId: string) {
  await traced("auth.new-admin-device", async () => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (!user || !user.role || user.role === "reader") return;
    if (await prisma.userDevice.findUnique({ where: { userId_deviceId: { userId, deviceId } }, select: { id: true } })) return;
    await sendEmail({
      to: user.email,
      userId,
      purpose: "admin_new_device",
      subject: "New device signed in to the Wangeci admin",
      react: createElement(AdminAlertEmail, { title: "New device signed in", body: "Your admin account was just signed in from a device we have not seen before. If this was not you, ask the owner to change your role or ban the account." }),
    });
    await logActivity({ userId, type: "admin.new_device" });
  });
}

/**
 * Better Auth instance: the single source of truth for who is signed in.
 * Passwordless: people prove themselves with a one-time code (email or phone) or Google.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // No passwords anywhere: the password endpoints are switched off on the server.
  emailAndPassword: { enabled: false },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // renew once a day of activity
    // Off on purpose: a ban, a revoked session or a replaced device must take effect on the very
    // next request, not up to 5 minutes later.
    cookieCache: { enabled: false },
    // Our own columns on the session row, so Better Auth reads and writes them.
    additionalFields: {
      deviceId: { type: "string", required: false, input: false },
      twoFactorVerifiedAt: { type: "date", required: false, input: false },
    },
  },

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: TRUSTED_ORIGINS,

  // Address recorded on sessions and used by Better Auth's own limiter. Vercel sets the first header itself
  // and strips client copies; the others are only the fallback elsewhere. Every limit WE enforce uses
  // clientIp() (right-most trusted hop), which does not depend on this list.
  advanced: { ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] } },

  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,

  hooks: {
    // Runs before every auth endpoint: lockout ladder, send limits, and no impersonation.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith("/admin/impersonate") || ctx.path === "/admin/stop-impersonating") {
        throw new APIError("FORBIDDEN", { code: "IMPERSONATION_DISABLED", message: "Impersonation is disabled." });
      }

      if (TWO_FACTOR_SETTINGS_PATHS.includes(ctx.path)) {
        const current = await getSessionFromCtx(ctx).catch(() => null);
        if (!current) throw new APIError("UNAUTHORIZED", { code: "AUTH_SESSION_REQUIRED", message: "Please sign in first." });
        if (ctx.path === "/two-factor/disable" && TWO_FACTOR_MANDATORY_ROLES.includes(current.user.role ?? "")) {
          throw new APIError("FORBIDDEN", { code: "AUTH_TWO_FACTOR_REQUIRED_FOR_ROLE", message: "Two-step sign-in cannot be switched off for staff accounts." });
        }
        if (!(await hasFreshStepUp(current.user.id, STEP_UP_ACCOUNT_MS))) {
          throw new APIError("FORBIDDEN", { code: "STEP_UP_REQUIRED", message: "Please confirm with a fresh email code first." });
        }
        return;
      }

      if (TWO_FACTOR_VERIFY_PATHS.includes(ctx.path)) {
        const current = await getSessionFromCtx(ctx).catch(() => null);
        const wait = current ? await totpLockedFor(current.user.id) : 0;
        if (wait > 0) {
          throw new APIError("TOO_MANY_REQUESTS", { code: "AUTH_TWO_FACTOR_LOCKED", message: `Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minutes.`, retryAfter: wait });
        }
        return;
      }

      const isSend = SEND_PATHS.includes(ctx.path);
      if (!isSend && !VERIFY_PATHS.includes(ctx.path)) return;

      const id = identifierFrom(ctx.body);
      if (!id) return;

      // A code check on an email whose account never proved its mailbox: remember it for the after hook.
      if (EMAIL_PROOF_PATHS.includes(ctx.path)) await markUnproven(id);

      const wait = await ladder.retryAfter(id);
      if (wait > 0) {
        throw new APIError("TOO_MANY_REQUESTS", { code: "OTP_LOCKED", message: `Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minutes.`, retryAfter: wait });
      }

      if (isSend) {
        const ip = ipOf(ctx.headers);
        const [byId, byIp] = await Promise.all([
          rateLimit(`otp:send:id:${id}`, 5, "30 m"),
          rateLimit(`otp:send:ip:${ip}`, 20, "1 h"),
        ]);
        if (!byId.ok || !byIp.ok) {
          throw new APIError("TOO_MANY_REQUESTS", { code: "OTP_SEND_LIMIT", message: "Too many code requests. Please wait a little.", retryAfter: Math.max(byId.retryAfter, byIp.retryAfter) });
        }

        if (ctx.path === "/phone-number/send-otp") {
          if (!isSmsCountryAllowed(id)) {
            throw new APIError("BAD_REQUEST", { code: "SMS_COUNTRY_NOT_ALLOWED", message: "We cannot text that country yet. Please use your email." });
          }
          // Each text costs money, so a stranger may only trigger one for a phone that already has an account.
          // The answer is the same either way, so this cannot be used to find out who is registered.
          const signedIn = await getSessionFromCtx(ctx).catch(() => null);
          if (!signedIn && !(await prisma.user.findUnique({ where: { phoneNumber: id }, select: { id: true } }))) {
            return ctx.json({ message: "code sent" });
          }
          await countSmsToday();
        }
      }
    }),

    // Runs after: a wrong code moves the ladder forward, a right one clears it.
    after: createAuthMiddleware(async (ctx) => {
      // A correct authenticator code (or backup code) marks THIS session as having passed the two-step check.
      if (TWO_FACTOR_VERIFY_PATHS.includes(ctx.path)) {
        const current = await getSessionFromCtx(ctx).catch(() => null);
        if (!current) return;
        if (ctx.context.returned instanceof Error) {
          // The 6-digit space is small: after a few wrong codes this session is thrown away and the step locks.
          if (await recordTotpFailure(current.user.id)) {
            await prisma.session.deleteMany({ where: { id: current.session.id } });
            await logActivity({ userId: current.user.id, type: "two_factor.locked" });
          }
          return;
        }
        await clearTotpFailures(current.user.id);
        // updateMany: when two-step was just switched on, the old session was replaced (and already marked), so there may be nothing to update.
        await prisma.session.updateMany({ where: { id: current.session.id }, data: { twoFactorVerifiedAt: new Date() } });
        await logActivity({ userId: current.user.id, type: "two_factor.verified" });
        return;
      }

      if (!VERIFY_PATHS.includes(ctx.path)) return;
      const id = identifierFrom(ctx.body);
      if (!id) return;

      const returned = ctx.context.returned;
      if (returned instanceof APIError || (returned instanceof Error && "status" in returned)) {
        const code = (returned as { body?: { code?: string } }).body?.code ?? "";
        // Only wrong or expired codes count. Rule refusals such as SESSION_ALREADY_ACTIVE do not.
        if (/INVALID_OTP|OTP_EXPIRED|TOO_MANY_ATTEMPTS/.test(code)) {
          const lockedFor = await ladder.recordFailure(id);
          if (lockedFor > 0) console.warn("[auth] OTP lock reached", { lockedFor });
        }
      } else if (returned) {
        await ladder.clear(id);
        if (EMAIL_PROOF_PATHS.includes(ctx.path)) {
          // The mailbox was just proved: drop what a stranger attached to the account first, then
          // record the proof so sensitive changes (two-step settings, refunds) can ask for it fresh.
          await settleFirstProof(id);
          const who = ctx.context.newSession?.user ?? (await getSessionFromCtx(ctx).catch(() => null))?.user;
          if (who && who.email.toLowerCase() === id) await markStepUp(who.id);
        }
      }
    }),
  },

  databaseHooks: {
    user: {
      create: { after: async (user) => bootstrapOwner(user) },
    },
    session: {
      create: {
        // One active session per account, decided on the server (see lib/auth/session-policy.ts).
        before: async (session, ctx) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { id: true, email: true, phoneNumber: true, twoFactorEnabled: true },
          });
          // Setting up or confirming two-step re-issues the person's OWN session (they are already signed in
          // and have just proved the code), so it is a replacement, never a second device.
          const sameSessionRenewal = Boolean(ctx?.path?.startsWith("/two-factor/"));
          if (user) {
            const decision = sameSessionRenewal ? "replace" : await decideNewSession(user);
            if (typeof decision === "object") {
              await logActivity({ userId: user.id, type: "login.blocked", metadata: { reason: "session_already_active" } });
              // The token proves this refusal followed a correct code; the client sends it back with the consent.
              throw new APIError("FORBIDDEN", {
                code: "SESSION_ALREADY_ACTIVE",
                message: "You are already signed in on another device.",
                replaceToken: decision.block.replaceToken,
              });
            }
            if (decision === "replace") {
              const revoked = await revokeOtherSessions(user.id);
              await logActivity({ userId: user.id, type: "session.replaced", metadata: { revoked } });
            }
          }
          const deviceId = readCookie(ctx?.headers, "device_id");
          // Accounts with two-step on start every NEW session unverified: nothing opens until the
          // authenticator code is entered (Better Auth only does this for password sign-ins, not for codes or Google).
          const verified = !user?.twoFactorEnabled || sameSessionRenewal;
          return { data: { ...session, deviceId, twoFactorVerifiedAt: verified ? new Date() : null } };
        },
        after: async (session) => {
          // Race backstop: if two sign-ins slipped through at once, the newest session survives.
          await prisma.session.deleteMany({
            where: {
              userId: session.userId,
              id: { not: session.id },
              OR: [{ createdAt: { lt: session.createdAt } }, { createdAt: session.createdAt, id: { lt: session.id } }],
            },
          });
          await logActivity({ userId: session.userId, type: "login" });
          const deviceId = (session as { deviceId?: string | null }).deviceId;
          if (deviceId) {
            await alertNewAdminDevice(session.userId, deviceId);
            await prisma.userDevice
              .upsert({
                where: { userId_deviceId: { userId: session.userId, deviceId } },
                create: { userId: session.userId, deviceId, label: (session.userAgent ?? "").slice(0, 120) || null },
                update: { lastSeenAt: new Date() },
              })
              .catch((error) => logError("auth.device-upsert", error, { userId: session.userId }));
          }
        },
      },
    },
  },

  plugins: [
    // Bot check on every request that would send a code (each SMS costs money).
    // Always listed (a fixed plugin list keeps Better Auth's TypeScript types exact). With no
    // TURNSTILE_SECRET_KEY the endpoint list is empty, so nothing is checked (local development).
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: env.TURNSTILE_SECRET_KEY ?? "",
      endpoints: env.TURNSTILE_SECRET_KEY ? CAPTCHA_PATHS : [],
    }),
    emailOTP({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_TTL_SECONDS,
      allowedAttempts: OTP_ATTEMPTS_PER_CODE,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp }) => {
        await dispatchOtp({ channel: "email", to: email, code: otp });
      },
    }),
    phoneNumber({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_TTL_SECONDS,
      allowedAttempts: OTP_ATTEMPTS_PER_CODE,
      phoneNumberValidator: isE164,
      sendOTP: async ({ phoneNumber: to, code }) => {
        await dispatchOtp({ channel: "sms", to, code });
      },
      // No signUpOnVerification: accounts start from the sign-up page (email first), then the
      // phone is verified onto the signed-in account. An unknown phone number cannot sign in.
    }),
    // allowPasswordless: the default 2FA setup asks for a password, and we have none.
    twoFactor({ issuer: "Wangeci", allowPasswordless: true }),
    checkoutClaim(),
    admin({ ac, roles, defaultRole: "reader", adminRoles: ["owner"] }),
    // Must be last so it can apply Better Auth's Set-Cookie headers through next/headers.
    nextCookies(),
  ],
});
