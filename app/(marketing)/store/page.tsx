import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { formatPrice, listBooks } from "@/lib/catalogue";
import { SITE } from "@/lib/site";

// Rendered per request (not at build time): the build has no database, and the catalogue is small and cheap to read.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store",
  description: `Books by ${SITE.authorName}, as ebook and audiobook.`,
  alternates: { canonical: "/store" },
};

/** `/store`: the book list. Works with one book and grows without changes. */
export default async function StorePage() {
  const books = await listBooks();

  return (
    <div className="mx-auto min-h-[70vh] max-w-[1100px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Store</h1>
      <p className="mt-3 text-lg text-navy/70">Books by {SITE.authorName}.</p>

      {books.length === 0 ? (
        <p className="mt-10 text-xl text-navy/70">No books are available right now. Please check back soon.</p>
      ) : (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => {
            const from = Math.min(...book.editions.map((e) => e.price));
            const currency = book.editions[0].currency;
            return (
              <li key={book.id}>
                <Link href={`/store/${book.slug}`} className="group block">
                  <div className="relative aspect-[334/473] overflow-hidden rounded-[20px] bg-white shadow-md transition-transform duration-300 group-hover:-translate-y-1">
                    <Image src={book.cover} alt={`${book.title} cover`} fill sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 90vw" className="object-cover" />
                  </div>
                  <h2 className="mt-4 font-display text-2xl text-navy group-hover:text-gold">{book.title}</h2>
                  <p className="text-navy/60">{book.author}</p>
                  <p className="mt-1 font-medium text-navy">From {formatPrice(from, currency)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
