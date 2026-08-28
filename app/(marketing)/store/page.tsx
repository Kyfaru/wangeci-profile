import type { Metadata } from "next";
import { BookCard } from "@/components/store/BookCard";
import { SectionHeading } from "@/components/ui";
import { MOCK_BOOKS } from "@/lib/mock-books";

export const metadata: Metadata = {
  title: "Store — Felister Wangechi Kariuki",
  description:
    "Books by Felister \"Wangechi\" Kariuki, including From Pieces To Power.",
};

/**
 * `/store` — catalog index. Not in the Figma file (only the "Book Preview"
 * frame for a single book was designed) — this is a straightforward grid
 * built to this project's shared design tokens, listing every entry in
 * `lib/mock-books.ts`.
 */
export default function StorePage() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-16 lg:px-12">
      <SectionHeading
        eyebrow="Store"
        description="Memoirs, field guides, and letters from Felister Wangechi Kariuki — for anyone rebuilding from the ground up."
      >
        Books
      </SectionHeading>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_BOOKS.map((book) => (
          <BookCard key={book.slug} book={book} />
        ))}
      </div>
    </div>
  );
}
