import type { Metadata } from "next";

import { AudioHost } from "@/components/audio/AudioHost";
import { MiniPlayer } from "@/components/audio/MiniPlayer";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic"; // reads the session cookie on every request

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Second gate (the proxy cookie check is only the front door): validates the real session.
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-cream">
      <div className="hidden md:block">
        <Sidebar user={user} />
      </div>
      <div className="min-w-0 flex-1">
        <MobileNav user={user} />
        {children}
      </div>
      {/* One audio element for the whole dashboard, so listening continues while browsing. */}
      <AudioHost />
      <MiniPlayer />
    </div>
  );
}
