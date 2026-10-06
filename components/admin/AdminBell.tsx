"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MaskIcon } from "@/components/ui/MaskIcon";

const POLL_MS = 60_000;

/** The admin bell: unread count for this admin's inbox, polled every 60 seconds. Links to /admin/inbox. */
export function AdminBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/notifications/unread-count", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count?: number } | null) => d && !cancelled && setCount(d.count ?? 0))
        .catch(() => {});
    void load();
    const id = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <Link href="/admin/inbox" aria-label={count > 0 ? `Inbox, ${count} unread` : "Inbox"} className="relative grid size-10 place-items-center text-black hover:opacity-70">
      <MaskIcon name="basil--notification-outline" size={26} />
      {count > 0 && <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-medium leading-5 text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
