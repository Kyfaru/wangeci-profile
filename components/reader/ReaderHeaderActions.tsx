"use client";

import { useEffect, useRef, useState } from "react";
import { AvatarStack, IconButton } from "@/components/ui";
import { BookmarkIcon } from "@/components/layout/icons";
import { apiClient } from "@/lib/api/client";
import { KebabIcon } from "./icons";

export interface ReaderHeaderActionsProps {
  editionId: string;
  chapterIdx: number;
  /** "Readers on this page" style avatar stack — decorative, per the Figma
   * reader frame's topbar. */
  readers: Array<{ src?: string; alt: string }>;
  className?: string;
}

/**
 * Client-side cluster for `ReaderTopbar`'s `rightSlot`: avatar stack +
 * bookmark toggle + kebab ("more") menu. `ReaderTopbar` itself only exposes
 * `title`/`subtitle`/`rightSlot` (no built-in breadcrumb/avatar/bookmark/menu
 * pattern despite the brief's description of it) — composed here instead of
 * editing that read-only component.
 */
export function ReaderHeaderActions({
  editionId,
  chapterIdx,
  readers,
  className,
}: ReaderHeaderActionsProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function toggleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    if (!next) return;
    // Best-effort: the mock endpoint requires a session (see
    // app/api/bookmarks/route.ts), which dev/preview may not have. The
    // visual toggle reflects intent either way rather than blocking on it.
    apiClient
      .post("/bookmarks", { editionId, chapterIdx, position: 0 })
      .catch(() => {});
  }

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <AvatarStack avatars={readers} size="sm" className="mr-1 hidden sm:flex" />

      <IconButton
        aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
        icon={
          <BookmarkIcon
            className={bookmarked ? "fill-gold-bright text-gold-bright" : undefined}
          />
        }
        variant="ghost"
        size="sm"
        onClick={toggleBookmark}
      />

      <div ref={menuRef} className="relative">
        <IconButton
          aria-label="More options"
          aria-expanded={menuOpen}
          icon={<KebabIcon />}
          variant="ghost"
          size="sm"
          onClick={() => setMenuOpen((open) => !open)}
        />
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-navy/10 bg-white py-1 shadow-lg"
          >
            {/* Placeholder items — no spec exists for kebab-menu contents
                beyond "the kebab menu icon should exist" (Figma frame). */}
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-navy hover:bg-navy/5"
              onClick={() => setMenuOpen(false)}
            >
              Font size
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-navy hover:bg-navy/5"
              onClick={() => setMenuOpen(false)}
            >
              Report an issue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
