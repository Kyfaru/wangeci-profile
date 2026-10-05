"use client";

import { useState } from "react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/** Bookmark toggle + kebab menu (Figma: "The Book" frame breadcrumb bar). No menu contents are designed yet, so the kebab is icon-only. */
export function ReaderActions({
  editionId,
  chapterIdx,
  initiallyBookmarked,
}: {
  editionId: string;
  chapterIdx: number;
  initiallyBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [pending, setPending] = useState(false);

  async function addBookmark() {
    if (pending || bookmarked) return; // un-bookmarking isn't designed yet
    setPending(true);
    setBookmarked(true); // optimistic
    try {
      await apiClient.post("/bookmarks", { editionId, chapterIdx, position: 0 });
    } catch {
      // No session cookie is set anywhere in this build yet (see lib/dashboard/current-user.ts),
      // so this 401s until a login flow exists — silently revert rather than surface an error.
      setBookmarked(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-4 text-black">
      <button
        type="button"
        onClick={addBookmark}
        aria-label={bookmarked ? "Bookmarked" : "Add bookmark"}
        aria-pressed={bookmarked}
        className={cn("transition-opacity hover:opacity-70", bookmarked && "text-gold")}
      >
        <MaskIcon name="basil--bookmark-outline" size={22} />
      </button>
      <button type="button" aria-label="More options" className="hover:opacity-70">
        <MaskIcon name="charm--menu-kebab" size={20} />
      </button>
    </div>
  );
}
