import type { Metadata } from "next";
import Link from "next/link";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { BOOK_HREF } from "@/lib/content/landing";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "My Books" };

/**
 * "My dashboard" Figma frame. Phase 0 keeps only the gate and an empty state;
 * Phase 4 rebuilds Continue Reading / Continue Listening from Entitlement rows.
 */
export default async function DashboardBooksPage() {
  await requireUser();

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        <h2 className="text-4xl font-medium text-black">My Books</h2>
        <p className="mt-4 text-xl text-black/70">You do not own any books yet.</p>
        <Link href={BOOK_HREF} className="mt-6 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
          Browse the book
        </Link>
      </div>
    </>
  );
}
