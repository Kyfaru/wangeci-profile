"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";

/**
 * Minimal shell: static `Sidebar` (desktop) / off-canvas drawer (mobile) +
 * `DashboardTopbar`, matching the Figma "My Dashboard" frame's structure.
 *
 * `PersistentAudioPlayer`/`MiniPlayer` are mounted once at the root
 * (`components/PlayerMount.tsx`, wired into `app/layout.tsx`) so playback
 * survives navigation across the whole site, not just this route group —
 * do not remount them here.
 *
 * The reader page (`/dashboard/books/[id]/read`) deliberately lives outside
 * this route group (`app/(reader)/...`) since it renders its own full-page
 * `Sidebar`/`ReaderTopbar` shell — nesting it here would double up both.
 */
const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/books": "My Books",
  "/dashboard/bookmarks": "My Bookmarks",
  "/dashboard/activity": "My Activity",
  "/dashboard/notifications": "Notifications",
  "/dashboard/settings": "Settings",
};

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = TITLES[pathname] ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 px-4 py-8 pb-28 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
