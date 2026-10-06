import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VerifyFlowClient } from "@/components/auth/VerifyFlowClient";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { TwoFactorStep } from "@/components/auth/TwoFactorStep";
import { getSession, hasPendingTwoFactor } from "@/lib/server/session";

export const metadata: Metadata = { title: "Verify", alternates: { canonical: "/verify" } };
export const dynamic = "force-dynamic";

/**
 * /verify: enter the code that was sent. `?step=complete` is where a signed-in person who has not
 * yet confirmed their phone is sent (see requireUser), so that case needs a real session.
 */
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const sp = await searchParams;
  const complete = sp.step === "complete";
  const twoStep = sp.step === "2fa";
  const redirectTo = safeRedirect(typeof sp.redirect === "string" ? sp.redirect : null);

  if (twoStep) {
    // Only someone who is signed in but owes the authenticator code belongs here.
    if (!(await hasPendingTwoFactor())) redirect("/sign-in");
    return <TwoFactorStep redirect={redirectTo} />;
  }

  if (complete) {
    const session = await getSession();
    if (!session) redirect("/sign-in");
    if (session.user.emailVerified && session.user.phoneNumberVerified) redirect(redirectTo);
  }

  return <VerifyFlowClient complete={complete} redirect={redirectTo} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
