import Link from "next/link";
import { AuthShell } from "@/components/layout";

/**
 * `/verify` — landing spot for an email verification link (e.g. from a
 * signup confirmation email), not a reset-password flow. The plan's
 * original "reset-password" flow doesn't apply anymore now that the app is
 * passwordless (see the plan's §2A) — `TwoFactorModal` on login/signup
 * already owns the OTP/2FA UX, so this page does nothing beyond acting as
 * a static confirmation landing spot. Kept intentionally small: a mock
 * frontend-only stub, not a redesign target.
 *
 * No `activeTab` is passed to `AuthShell` — this page isn't part of the
 * Sign In / Sign Up pair the shell's tab switcher is for.
 */
export default function VerifyPage() {
  return (
    <AuthShell
      title="Verifying your email"
      description="Hang tight — this confirms the email address on your account."
    >
      <div className="flex flex-col gap-6">
        <p className="text-sm text-gray">
          If you followed a verification link from your email, your address
          has been confirmed. In this mock/frontend-only phase, no real
          verification token is checked here — continue on to sign in or
          jump straight to your dashboard.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-navy px-6 text-base font-medium tracking-tight text-cream transition-colors duration-150 hover:bg-navy/90"
          >
            Continue to Sign In
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-navy px-6 text-base font-medium tracking-tight text-navy transition-colors duration-150 hover:bg-navy/5"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
