import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/SignUpForm";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Create account", alternates: { canonical: "/sign-up" } };
export const dynamic = "force-dynamic";

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const sp = await searchParams;
  const redirectTo = safeRedirect(typeof sp.redirect === "string" ? sp.redirect : null);
  if (await getSession()) redirect(redirectTo);

  return <SignUpForm redirect={redirectTo} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
