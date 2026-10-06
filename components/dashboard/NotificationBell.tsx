"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { MaskIcon } from "@/components/ui/MaskIcon";

const POLL_MS = 60_000;

/** Bell with an unread count. Polls one cheap route every 60 seconds (and again when the tab is shown). */
export function NotificationBell() {
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
    const onShow = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return (
    <Link href="/dashboard/notifications" aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"} className="relative grid size-11 place-items-center text-black transition-opacity hover:opacity-70">
      <MaskIcon name="basil--notification-outline" size={28} />
      {count > 0 && <span className="absolute right-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-medium leading-5 text-white">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
