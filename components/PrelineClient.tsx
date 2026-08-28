"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Boots Preline UI's runtime (accordions, tabs, dropdowns, collapses,
 * carousels, etc.) and re-initializes it on every client-side route change.
 *
 * Mounted once in the root `app/layout.tsx` — deliberately not per-layout
 * (e.g. `(marketing)/layout.tsx`) so there's a single global init that
 * covers every route group. `preline/non-auto` is imported dynamically so
 * its runtime never ends up in the server bundle.
 *
 * Next.js App Router does a soft navigation (no full document reload), so
 * Preline's own auto-init-on-DOMContentLoaded never fires again after the
 * first route. `cleanCollection()` drops any stale bindings from the
 * previous page before `autoInit()` re-scans the new DOM, so components on
 * newly rendered pages (and remounted components carrying the same
 * `data-hs-*` markup) get wired up correctly.
 */
export function PrelineClient() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    import("preline/non-auto").then(({ HSStaticMethods }) => {
      if (cancelled) return;
      HSStaticMethods.cleanCollection();
      HSStaticMethods.autoInit();
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
