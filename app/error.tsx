"use client";

import Link from "next/link";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-cream px-6 text-center text-navy">
      <div>
        <p className="font-display text-6xl text-gold">Oops</p>
        <h1 className="mt-4 font-display text-3xl">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-md text-lg text-navy/70">
          We have been told about it. Please try again.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button onClick={reset} className="rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
            Try again
          </button>
          <Link href="/" className="rounded-[40px] border border-navy/30 px-8 py-3 text-lg font-medium transition-colors hover:border-gold hover:text-gold">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
