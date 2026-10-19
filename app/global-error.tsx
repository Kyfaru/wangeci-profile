"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary: replaces the root layout, so it brings its own html/body and inline styles
 * (the stylesheet and fonts are not loaded here).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const button = { padding: "12px 28px", borderRadius: 40, fontSize: 18, fontWeight: 500, cursor: "pointer", textDecoration: "none" } as const;

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f0e6", color: "#0c2142", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <main>
          <h1 style={{ fontSize: 32, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: 16, fontSize: 18, opacity: 0.7 }}>We have been told about it. Please try again.</p>
          {error.digest && <p style={{ fontSize: 14, opacity: 0.5 }}>Reference: {error.digest}</p>}
          <div style={{ marginTop: 32, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={reset} style={{ ...button, border: 0, background: "#0c2142", color: "#f5f0e6" }}>
              Try again
            </button>
            {/* A plain anchor on purpose: the router may be what broke. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ ...button, border: "1px solid rgba(12,33,66,0.3)", color: "#0c2142" }}>
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
