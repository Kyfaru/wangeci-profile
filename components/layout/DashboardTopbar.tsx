"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/hooks/use-session";
import { Avatar } from "@/components/ui";
import { BellIcon, MenuIcon, SearchIcon } from "./icons";

export interface DashboardTopbarProps {
  className?: string;
  /** Page heading shown on the left, e.g. "Dashboard" or "My Books". */
  title?: string;
  /** Shows the mobile hamburger and fires on tap — wire to `Sidebar`'s
   * `open` state at the page/layout level. Omit to hide the button
   * (e.g. a page that renders `Sidebar` without the drawer props). */
  onMenuClick?: () => void;
  /** Where the search affordance navigates on submit, as `?q=<term>`.
   * Defaults to "/search" (that route doesn't exist yet — a later build
   * step owns it). */
  searchHref?: string;
}

const UNREAD_COUNT_POLL_MS = 60_000;

/**
 * Top bar for dashboard pages: user identity, a notification bell backed by
 * `GET /api/notifications/unread-count`, and a lightweight search box.
 *
 * The unread-count query is colocated here rather than lifted into
 * `lib/hooks/*` — it's a single-purpose read used by exactly one component,
 * so a shared hook would be premature abstraction.
 */
export function DashboardTopbar({
  className,
  title,
  onMenuClick,
  searchHref = "/search",
}: DashboardTopbarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");

  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiClient.get<{ count: number }>("/notifications/unread-count"),
    staleTime: UNREAD_COUNT_POLL_MS,
    refetchInterval: UNREAD_COUNT_POLL_MS,
    retry: false,
  });

  const unreadCount = unread?.count ?? 0;
  const user = session?.user;

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `${searchHref}?q=${encodeURIComponent(trimmed)}` : searchHref);
  }

  return (
    <header
      className={cn(
        "flex h-20 items-center gap-4 border-b border-navy/10 bg-cream px-4 lg:px-8",
        className,
      )}
    >
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open dashboard menu"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy hover:bg-navy/5 lg:hidden"
        >
          <MenuIcon className="size-5" />
        </button>
      )}

      {title && (
        <h1 className="hidden font-display text-xl text-navy sm:block">
          {title}
        </h1>
      )}

      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="ml-auto flex w-full max-w-sm items-center gap-2 rounded-full border border-navy/15 bg-white px-4 py-2 focus-within:border-gold-bright"
      >
        <SearchIcon className="size-4 shrink-0 text-gray" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search books, chapters..."
          aria-label="Search"
          className="w-full bg-transparent text-sm text-navy outline-none placeholder:text-gray"
        />
      </form>

      <Link
        href="/dashboard/notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy hover:bg-navy/5"
      >
        <BellIcon className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 inline-flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold-bright px-1 text-[10px] font-bold text-navy">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>

      <Link
        href="/dashboard/settings"
        className="flex shrink-0 items-center gap-2 rounded-full py-1 pr-1 pl-2 transition-colors hover:bg-navy/5"
      >
        <span className="hidden text-sm font-medium text-navy sm:block">
          {user?.name ?? "Guest"}
        </span>
        <Avatar src={user?.avatar} alt={user?.name ?? "Guest"} size="sm" />
      </Link>
    </header>
  );
}
