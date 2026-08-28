import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import PasswordResetEmail from "@/emails/password-reset-email";
import VerifyEmail from "@/emails/verify-email";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// No CORS_TRUSTED_ORIGINS-shaped var exists in lib/env.ts yet, so localhost
// is hardcoded here rather than inventing a new required env var — flag to
// the foundation agent if production needs an additional trusted origin.
const TRUSTED_ORIGINS = ["http://localhost:3000"];

/**
 * Better Auth instance — the single source of truth for sessions, sign-up,
 * sign-in, and email verification/reset flows across the app.
 * Why it exists: centralizing auth config here (rather than duplicating
 * session checks per route) keeps password hashing, session expiry, and
 * email delivery consistent everywhere `auth.api.*` is called.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Wangeci password",
        react: PasswordResetEmail({ url }),
        userId: user.id,
        purpose: "password-reset",
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Wangeci email",
        react: VerifyEmail({ url }),
        userId: user.id,
        purpose: "email-verification",
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day of activity
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes — avoids a DB round trip on every request
    },
  },

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: TRUSTED_ORIGINS,

  // Must be last so it can intercept Better Auth's Set-Cookie headers and
  // apply them via next/headers — required for Server Actions/Route
  // Handlers to set cookies correctly in the Next.js App Router.
  plugins: [nextCookies()],
});
