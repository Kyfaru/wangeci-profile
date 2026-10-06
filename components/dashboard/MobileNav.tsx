"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** Phones and small tablets: a slim top bar with a menu button that opens the sidebar as a drawer. */
export function MobileNav({ children, title = "Wangeci" }: { children: ReactNode; title?: string }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname; // navigating to another page closes the drawer by itself

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/10 bg-cream/95 px-4 backdrop-blur">
        <button type="button" onClick={() => setOpenAt(pathname)} aria-label="Open menu" aria-expanded={open} className="grid size-10 place-items-center rounded-lg hover:bg-black/5">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="font-display text-lg text-navy">{title}</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" onClick={() => setOpenAt(null)} className="absolute inset-0 bg-navy/60" />
          <div className="relative h-full w-[min(347px,85vw)]">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
