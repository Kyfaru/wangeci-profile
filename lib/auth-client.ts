/**
 * Better Auth browser client: the counterpart of lib/auth.ts.
 * Passwordless: email code, phone code, Google. Two-factor (authenticator app) is used by admins.
 */
import { createAuthClient } from "better-auth/client";
import { adminClient, emailOTPClient, phoneNumberClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), phoneNumberClient(), twoFactorClient(), adminClient()],
});
