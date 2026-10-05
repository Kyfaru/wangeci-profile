import Link from "next/link";
import type { ReactNode } from "react";

/** "Home > My Books > {title}" bar for the reader (Figma: "The Book" frame). */
export function BreadcrumbBar({ bookTitle, actions }: { bookTitle: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-cream px-6 py-6 md:px-10">
      <p className="font-display text-base text-black">
        <Link href="/dashboard" className="hover:opacity-70">
          Home
        </Link>{" "}
        <span className="text-gold">{">"}</span>{" "}
        <Link href="/dashboard/books" className="hover:opacity-70">
          My Books
        </Link>{" "}
        <span className="text-gold">{">"}</span> <span className="text-gold">{bookTitle}</span>
      </p>
      {actions}
    </div>
  );
}
