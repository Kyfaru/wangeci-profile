import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign in",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: false },
};

/** Placeholder so the protected-page redirect never lands on a 404. Phase 1 builds the real page. */
export default function SignInPage() {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-6 pb-24 pt-40 text-center text-navy">
      <div>
        <h1 className="font-display text-4xl">Sign-in opens soon</h1>
        <p className="mt-4 text-lg text-navy/70">Reader accounts are almost ready. Please check back shortly.</p>
        <Link href="/" className="mt-8 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
          Back home
        </Link>
      </div>
    </div>
  );
}
