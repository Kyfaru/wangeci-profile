import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/Footer";
import { Navbar } from "@/components/marketing/Navbar";
import { BOOK_HREF } from "@/lib/content/landing";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="grid min-h-[70vh] place-items-center bg-cream px-6 pb-24 pt-40 text-center text-navy">
        <div>
          <p className="font-display text-7xl text-gold">404</p>
          <h1 className="mt-4 font-display text-4xl">This page could not be found</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-navy/70">
            The link may be old, or the page has not been published yet.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/" className="rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
              Go home
            </Link>
            <Link href={BOOK_HREF} className="rounded-[40px] border border-navy/30 px-8 py-3 text-lg font-medium transition-colors hover:border-gold hover:text-gold">
              See the book
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
