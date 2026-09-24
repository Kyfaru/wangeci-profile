import type { Metadata } from "next";
import { ShareCard } from "@/components/marketing";
import { findBookBySlug } from "@/lib/mock-books";

/**
 * No real "share" data model exists yet (no Figma frame, no API contract
 * in the System Connections Doc) — this page is built against a simple
 * inline shape rather than a `lib/mock-*` fixture. `id` stands in for a
 * referral/share code; a handful of example ids resolve to a specific
 * quote + sharer below, and any other id falls back to a generic share of
 * the flagship book so an arbitrary/real-looking id still renders sensibly.
 */
interface SharedBookHighlight {
  bookSlug: string;
  quote: string;
  sharedBy: string;
}

const MOCK_SHARES: Record<string, SharedBookHighlight> = {
  "demo-amina": {
    bookSlug: "from-pieces-to-power",
    quote:
      "When you believe a lie, you begin to live in bondage; the truth is what sets you free.",
    sharedBy: "Amina W.",
  },
  "demo-shea-ledger": {
    bookSlug: "the-shea-ledger",
    quote:
      "Margin isn't a feeling, it's arithmetic — and I built three spreadsheets before I believed that.",
    sharedBy: "The Fechi Organics team",
  },
};

const DEFAULT_SHARE: SharedBookHighlight = {
  bookSlug: "from-pieces-to-power",
  quote:
    "Power, I've learned, isn't a place you arrive at. It's a practice you return to every morning.",
  sharedBy: "a reader in Wangechi's community",
};

function resolveShare(id: string): SharedBookHighlight {
  return MOCK_SHARES[id] ?? DEFAULT_SHARE;
}

export async function generateMetadata({
  params,
}: PageProps<"/share/[id]">): Promise<Metadata> {
  const { id } = await params;
  const share = resolveShare(id);
  const book = findBookBySlug(share.bookSlug);

  return {
    title: book ? `${book.title} — Shared by ${share.sharedBy}` : "Shared highlight",
    description: share.quote,
  };
}

/**
 * `/share/[id]` — a single centered highlight card for a shared book quote
 * or referral link. Low-priority page, kept intentionally simple: server
 * component, no interactivity, falls back to the flagship book if `id`
 * isn't one of the couple of demo ids above.
 */
export default async function SharePage({
  params,
}: PageProps<"/share/[id]">) {
  const { id } = await params;
  const share = resolveShare(id);
  const book = findBookBySlug(share.bookSlug) ?? findBookBySlug("from-pieces-to-power")!;

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gray-light px-6 py-20">
      <ShareCard book={book} quote={share.quote} sharedBy={share.sharedBy} />
    </div>
  );
}
