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
    author: "Felister \"Wangechi\" Kariuki",
    cover: "/books/from-pieces-to-power/cover.jpg",
    description:
      "A raw, unflinching memoir about losing everything and rebuilding a life, a business, and a sense of self from the ground up.",
    longDescription:
      "When Felister \"Wangechi\" Kariuki lost her marriage, her income, and her sense of direction within the same year, she had two choices: disappear into the wreckage, or use every piece of it to build something new. From Pieces To Power is the story of that rebuild — messy, funny, spiritual, and deeply practical. Part memoir, part field guide for anyone starting over, it follows Wangechi from a single rented room in Nairobi to founding Fechi Organics and becoming a voice for women rebuilding after loss. Readers walk away with not just her story, but the frameworks she used to reclaim her time, her money, and her voice.",
    price: 1800,
    currency: "KES",
    rating: 4.8,
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
        narrator: "Felister \"Wangechi\" Kariuki",
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
  {
    slug: "the-shea-ledger",
    title: "The Shea Ledger",
    subtitle: "Building a Business on Borrowed Time and Borrowed Money",
    author: "Felister \"Wangechi\" Kariuki",
    cover: "/books/the-shea-ledger/cover.jpg",
    description:
      "The unglamorous, spreadsheet-level story of turning a kitchen-table skincare line into a real company.",
    longDescription:
      "A companion volume to From Pieces To Power, The Shea Ledger goes deep on the operational side of building Fechi Organics: sourcing, pricing, cash flow, and the specific mistakes that nearly closed the business twice in its first eighteen months.",
    price: 1500,
    currency: "KES",
    rating: 4.6,
    reviewCount: 87,
    tags: ["entrepreneurship", "small-business", "finance"],
    publishedAt: "2025-09-01T00:00:00.000Z",
    editions: [
      {
        id: "shea-ledger-ebook-v1",
        format: "ebook",
        label: "Ebook Edition",
        chapters: [
          {
            idx: 0,
            title: "Introduction: The Ledger Doesn't Lie",
            wordCount: 1100,
            isFreePreview: true,
            content:
              "Every business has a story it tells and a ledger that tells the truth. This book is about the gap between the two, and how I closed it...",
          },
          {
            idx: 1,
            title: "Chapter 1: Sourcing Shea Without a Supplier",
            wordCount: 1890,
            isFreePreview: true,
            content:
              "My first shea butter supplier ghosted me two weeks before my first market. Here's what that taught me about vetting cooperatives...",
          },
          {
            idx: 2,
            title: "Chapter 2: Pricing for Survival, Not Vanity",
            wordCount: 2005,
            isFreePreview: false,
            content:
              "I built three pricing spreadsheets before I understood that margin isn't a feeling, it's arithmetic...",
          },
        ],
      },
    ],
  },
  {
    slug: "letters-to-the-woman-rebuilding",
    title: "Letters to the Woman Rebuilding",
    author: "Felister \"Wangechi\" Kariuki",
    cover: "/books/letters-to-the-woman-rebuilding/cover.jpg",
    description:
      "A short collection of letters written to readers going through their own rebuild — grief, divorce, job loss, and starting again.",
    longDescription:
      "Written in the two years after From Pieces To Power, these letters started as replies to reader emails. Collected here for the first time, they're short enough to read in a single sitting on a hard day.",
    price: 900,
    currency: "KES",
    rating: 4.9,
    reviewCount: 56,
    tags: ["memoir", "personal-growth", "grief"],
    publishedAt: "2026-01-20T00:00:00.000Z",
    editions: [
      {
        id: "letters-ebook-v1",
        format: "ebook",
        label: "Ebook Edition",
        chapters: [
          {
            idx: 0,
            title: "Letter One: To the Woman on the Kitchen Floor",
            wordCount: 640,
            isFreePreview: true,
            content:
              "I don't know what brought you to the floor today, but I know the floor. I want you to know it's not the ending it feels like...",
          },
          {
            idx: 1,
            title: "Letter Two: To the Woman Who Hasn't Told Anyone Yet",
            wordCount: 580,
            isFreePreview: false,
            content:
              "Secrets are heavy in a specific way — they take up the exact amount of room you need for hope...",
          },
        ],
      },
      {
        id: "letters-audio-v1",
        format: "audiobook",
        label: "Audiobook — narrated by the author",
        narrator: "Felister \"Wangechi\" Kariuki",
        chapters: [
          {
            idx: 0,
            title: "Letter One: To the Woman on the Kitchen Floor",
            durationSeconds: 312,
            isFreePreview: true,
            audioUrl: "/audio/letters-to-the-woman-rebuilding/letter1.m4a",
            timingUrl:
              "/audio/letters-to-the-woman-rebuilding/letter1.timing.json",
          },
          {
            idx: 1,
            title: "Letter Two: To the Woman Who Hasn't Told Anyone Yet",
            durationSeconds: 287,
            isFreePreview: false,
            audioUrl: "/audio/letters-to-the-woman-rebuilding/letter2.m4a",
            timingUrl:
              "/audio/letters-to-the-woman-rebuilding/letter2.timing.json",
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
