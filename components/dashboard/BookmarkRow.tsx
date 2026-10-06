"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** One saved place: opens the reader at that word; a button removes it. */
export function BookmarkRow({ id, href, book, chapter, savedAt }: { id: string; href: string; book: string; chapter: string; savedAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <Link href={href} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate text-lg font-medium text-black">{book}</span>
        <span className="block truncate text-sm text-black/60">
          {chapter} · saved {savedAt}
        </span>
      </Link>
      <button type="button" onClick={remove} disabled={busy} className="shrink-0 text-sm text-black/60 underline underline-offset-4 hover:text-gold disabled:opacity-50">
        Remove
      </button>
    </li>
  );
}
