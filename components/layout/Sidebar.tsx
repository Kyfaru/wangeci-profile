"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  ActivityIcon,
  BellIcon,
  BookIcon,
  BookmarkIcon,
  HomeIcon,
  SettingsIcon,
} from "./icons";

export interface SidebarProps {
  className?: string;
  /**
   * Controls the mobile off-canvas drawer. Omit both this and `onClose`
   * entirely to render the sidebar as a static, always-visible desktop
   * column (hidden below `lg`) with no drawer/backdrop — the simplest
   * option for a page that doesn't yet have a mobile menu button wired up.
   * Pass both once a `DashboardTopbar`'s `onMenuClick` has somewhere to
   * toggle state into.
   */
  open?: boolean;
  onClose?: () => void;
}

interface SidebarLink {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Only true for the dashboard home — every other route also needs to
   * NOT match on this to avoid every nested route lighting up "Dashboard". */
  exact?: boolean;
}

const SIDEBAR_LINKS: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon, exact: true },
  { href: "/dashboard/books", label: "Books", icon: BookIcon },
  { href: "/dashboard/bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { href: "/dashboard/activity", label: "Activity", icon: ActivityIcon },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: BellIcon,
  },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(pathname: string, link: SidebarLink): boolean {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <div className="flex h-full flex-col bg-navy text-cream">
      <div className="px-6 py-8">
        <Link href="/" className="font-display text-lg">
          Wangechi Kariuki
        </Link>
      </div>
      <nav aria-label="Dashboard" className="flex-1 space-y-1 px-4">
        {SIDEBAR_LINKS.map((link) => {
          const active = isActive(pathname, link);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-cream/70 transition-colors",
                active
                  ? "bg-gold-bright text-navy"
                  : "hover:bg-cream/10 hover:text-cream",
              )}
            >
              <Icon className="size-5 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-6 text-xs text-cream/40">
        From Pieces To Power
      </div>
    </div>
  );
}

/**
 * Dashboard-side vertical nav. Desktop-first: renders as a static 16rem
 * column on `lg+` regardless of `open`/`onClose`. When those are provided,
 * it additionally renders as a controlled off-canvas drawer with a backdrop
 * below `lg` — pass `open` from the page/layout composing this alongside
 * `DashboardTopbar`'s `onMenuClick`.
 */
export function Sidebar({ className, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const isControlled = open !== undefined;

  return (
    <>
      {isControlled && (
        <>
          <div
            aria-hidden="true"
            onClick={onClose}
            className={cn(
              "fixed inset-0 z-40 bg-navy/50 transition-opacity lg:hidden",
              open ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-64 shadow-xl transition-transform duration-200 lg:hidden",
              open ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <SidebarContent pathname={pathname} />
          </div>
        </>
      )}

      <div className={cn("hidden lg:block lg:h-full lg:w-64 lg:shrink-0", className)}>
        <SidebarContent pathname={pathname} />
      </div>
    </>
  );
}
