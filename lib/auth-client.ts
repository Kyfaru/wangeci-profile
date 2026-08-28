/**
 * Better Auth client SDK instance — frontend-owned counterpart to
 * `lib/auth.ts` (server-side, do not edit from here).
 *
 * Adds the three client plugins the passwordless login/signup flow and the
 * `TwoFactorModal` need:
 *   - `emailOTPClient`   — `authClient.emailOtp.sendVerificationOtp(...)`,
 *                           `authClient.signIn.emailOtp(...)`
 *   - `phoneNumberClient` — `authClient.phoneNumber.sendOtp(...)`,
 *                            `authClient.phoneNumber.verify(...)`
 *   - `twoFactorClient`   — `authClient.twoFactor.verifyTotp(...)`
 *
 * These only work once the matching server-side plugins
 * (`emailOTP`/`phoneNumber`/`twoFactor`) are added to `lib/auth.ts` and
 * `npx @better-auth/cli generate` + a Prisma migration have run — that's
 * backend-session territory (see the passwordless auth redesign plan,
 * §2A). Until then, calls against this client will fail at runtime; the
 * UI is still expected to render and be exercised locally.
 */
import { createAuthClient } from "better-auth/client";
import {
  emailOTPClient,
  phoneNumberClient,
  twoFactorClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), phoneNumberClient(), twoFactorClient()],
});
