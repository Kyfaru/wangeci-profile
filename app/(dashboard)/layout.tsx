import type { Metadata } from "next";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic"; // reads the session cookie on every request

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Second gate (the proxy cookie check is only the front door): validates the real session.
  const user = await requireUser();

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar user={user} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
