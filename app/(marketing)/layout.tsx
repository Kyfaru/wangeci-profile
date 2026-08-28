import type { ReactNode } from "react";
import { Footer, Navbar } from "@/components/layout";

/**
 * Shared shell for every public marketing route (`/`, `/about`, `/store`,
 * `/services`, `/blog`, `/cart`, `/checkout`, `/share/[id]`) — Navbar on
 * top, Footer at the bottom, page content in between.
 */
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
