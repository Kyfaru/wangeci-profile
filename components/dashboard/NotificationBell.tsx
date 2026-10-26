"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MaskIcon } from "@/components/ui/MaskIcon";

const POLL_MS = 60_000;

/**
 * Bell with an unread count, used by the dashboard and the admin panel. Polls one cheap route every
 * 60 seconds (and again when the tab is shown). `compact` is the admin top bar's smaller size.
 */
export function NotificationBell({ href = "/dashboard/notifications", label = "Notifications", compact = false }: { href?: string; label?: string; compact?: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/notifications/unread-count", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { count?: number } | null) => d && !cancelled && setCount(d.count ?? 0))
        .catch(() => {}); // ponytail: a missed poll is retried in 60 s; the bell just keeps its last count
    void load();
    const id = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      className={`relative grid place-items-center text-black transition-opacity hover:opacity-70 ${compact ? "size-10" : "size-11"}`}
    >
      <MaskIcon name="basil--notification-outline" size={compact ? 26 : 28} />
      {count > 0 && <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-medium leading-5 text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
