/**
 * Mock book catalog fixtures. Typed (not JSON) so the shapes flow straight
 * into the Route Handlers under app/api/books/**, app/api/reader/**, and
 * app/api/user/library — matching the real backend's contract so this file
 * is the only thing that changes when Prisma/Postgres data replaces it.
 */

export type BookFormat = "ebook" | "audiobook";

export interface ReadingChapter {
  idx: number;
  title: string;
  wordCount: number;
  /** Mock chapter body (short — this is fixture data, not the real text). */
  content: string;
  isFreePreview: boolean;
}

export interface ListeningChapter {
  idx: number;
  title: string;
  durationSeconds: number;
  /**
   * Reference to a pre-generated narration file + word-timing JSON.
   * Audio generation itself is out of scope here (backend/ElevenLabs job) —
   * these are just the fixture-shaped references a later player UI expects.
   */
  audioUrl: string;
  timingUrl: string;
  isFreePreview: boolean;
}

export interface BookEdition {
  id: string;
  format: BookFormat;
  /** e.g. "Ebook Edition", "Audiobook — narrated by Wanjiru Kamau" */
  label: string;
  narrator?: string;
  chapters: ReadingChapter[] | ListeningChapter[];
}

export interface Book {
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  cover: string;
  description: string;
  longDescription: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  tags: string[];
  publishedAt: string;
  editions: BookEdition[];
}

export const MOCK_BOOKS: Book[] = [
  {
    slug: "from-pieces-to-power",
    title: "From Pieces To Power",
    subtitle: "A Memoir of Rebuilding After Everything Fell Apart",
    author: "Wangeci Kariuki",
    cover: "/images/from-pieces-to-power-front-cover.png",
    description:
      "A raw, unflinching memoir about losing everything and rebuilding a life, a business, and a sense of self from the ground up.",
    longDescription:
      "She walked barefoot to school on dusty village roads, raised by siblings barely older than herself. When her mother died, she lost more than a parent: she lost her home, her place in the world.", // TODO(client)
    price: 2000,
    currency: "KES",
    rating: 4.2,
    reviewCount: 214,
    tags: ["memoir", "entrepreneurship", "personal-growth", "women"],
    publishedAt: "2025-03-10T00:00:00.000Z",
    editions: [
      {
        id: "fptp-ebook-v1",
        format: "ebook",
        label: "Ebook Edition",
        chapters: [
          {
            idx: 0,
            title: "Prologue: The Floor",
            wordCount: 1420,
            isFreePreview: true,
            content:
              "The morning everything ended, I was sitting on the kitchen floor of a house that was no longer mine, holding a mug that was. I want to tell you it was dramatic — that I screamed, or broke something. Mostly I just sat there, doing the math on a life that no longer added up...",
          },
          {
            idx: 1,
            title: "Chapter 1: What the Fire Left",
            wordCount: 2210,
            isFreePreview: true,
            content:
              "People love to say that rock bottom is a foundation, but nobody tells you rock bottom has a smell — it smells like other people's pity casseroles. I spent the first three weeks after the divorce filing eating other people's pity casseroles and calling it self-care...",
          },
          {
            idx: 2,
            title: "Chapter 2: The Register at Fechi's",
            wordCount: 2540,
            isFreePreview: false,
            content:
              "I registered Fechi Organics on a Tuesday with KES 4,000 and a borrowed laptop. The name came from my grandmother, Fechi, who pressed her own shea butter by hand and swore it cured everything from cracked heels to a broken heart...",
          },
          {
            idx: 3,
            title: "Chapter 3: Learning to Ask for the Sale",
            wordCount: 1980,
            isFreePreview: false,
            content:
              "Nobody warns you that the hardest part of entrepreneurship isn't the product. It's opening your mouth and telling someone the price without apologizing for it. I lost six months to underpricing before I learned that lesson...",
          },
          {
            idx: 4,
            title: "Chapter 4: The Second Marriage — To Myself",
            wordCount: 2330,
            isFreePreview: false,
            content:
              "There's a version of this book where I tell you I found a new relationship and that fixed everything. That's not this book. This is the chapter about the vows I made to myself instead, and kept...",
          },
          {
            idx: 5,
            title: "Epilogue: Power Is a Practice",
            wordCount: 1150,
            isFreePreview: false,
            content:
              "Power, I've learned, isn't a place you arrive at. It's a practice you return to every morning, usually before coffee, usually while still a little afraid...",
          },
        ],
      },
      {
        id: "fptp-audio-v1",
        format: "audiobook",
        label: "Audiobook — narrated by the author",
        narrator: "Wangeci Kariuki",
        chapters: [
          {
            idx: 0,
            title: "Prologue: The Floor",
            durationSeconds: 612,
            isFreePreview: true,
            audioUrl: "/audio/from-pieces-to-power/ch0-prologue.m4a",
            timingUrl: "/audio/from-pieces-to-power/ch0-prologue.timing.json",
          },
          {
            idx: 1,
            title: "Chapter 1: What the Fire Left",
            durationSeconds: 934,
            isFreePreview: true,
            audioUrl: "/audio/from-pieces-to-power/ch1-what-the-fire-left.m4a",
            timingUrl:
              "/audio/from-pieces-to-power/ch1-what-the-fire-left.timing.json",
          },
          {
            idx: 2,
            title: "Chapter 2: The Register at Fechi's",
            durationSeconds: 1080,
            isFreePreview: false,
            audioUrl: "/audio/from-pieces-to-power/ch2-the-register.m4a",
            timingUrl: "/audio/from-pieces-to-power/ch2-the-register.timing.json",
          },
          {
            idx: 3,
            title: "Chapter 3: Learning to Ask for the Sale",
            durationSeconds: 861,
            isFreePreview: false,
            audioUrl: "/audio/from-pieces-to-power/ch3-ask-for-the-sale.m4a",
            timingUrl:
              "/audio/from-pieces-to-power/ch3-ask-for-the-sale.timing.json",
          },
          {
            idx: 4,
            title: "Chapter 4: The Second Marriage — To Myself",
            durationSeconds: 1005,
            isFreePreview: false,
            audioUrl: "/audio/from-pieces-to-power/ch4-second-marriage.m4a",
            timingUrl:
              "/audio/from-pieces-to-power/ch4-second-marriage.timing.json",
          },
          {
            idx: 5,
            title: "Epilogue: Power Is a Practice",
            durationSeconds: 498,
            isFreePreview: false,
            audioUrl: "/audio/from-pieces-to-power/ch5-epilogue.m4a",
            timingUrl: "/audio/from-pieces-to-power/ch5-epilogue.timing.json",
          },
        ],
      },
    ],
  },
];

export function findBookBySlug(slug: string): Book | undefined {
  return MOCK_BOOKS.find((b) => b.slug === slug);
}

export function findEditionById(
  editionId: string
): { book: Book; edition: BookEdition } | undefined {
  for (const book of MOCK_BOOKS) {
    const edition = book.editions.find((e) => e.id === editionId);
    if (edition) return { book, edition };
  }
  return undefined;
}
