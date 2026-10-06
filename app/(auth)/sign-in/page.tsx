import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/SignInForm";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { env } from "@/lib/env";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Sign in", alternates: { canonical: "/sign-in" } };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  // Only same-site paths are honoured (an open redirect would let an attacker bounce users elsewhere).
  const redirectTo = safeRedirect(typeof sp.redirect === "string" ? sp.redirect : null);
  if (await getSession()) redirect(redirectTo);

  return (
    <SignInForm
      redirect={redirectTo}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      initialError={typeof sp.error === "string" ? sp.error : undefined}
    />
  );
}
