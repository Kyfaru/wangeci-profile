/**
 * Mock blog post fixtures.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  publishedAt: string;
  tags: string[];
  readTimeMinutes: number;
}

export const MOCK_BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-nobody-tells-you-about-starting-over-at-34",
    title: "What Nobody Tells You About Starting Over at 34",
    excerpt:
      "The version of starting over that Instagram doesn't show you: the spreadsheets, the pity casseroles, and the very slow climb.",
    content:
      "When people ask what it was like to start over at 34, they usually want the highlight reel. Here's the part before the highlight reel...",
    coverImage: "/blog/starting-over-at-34/cover.jpg",
    author: "Felister \"Wangechi\" Kariuki",
    publishedAt: "2025-04-02T09:00:00.000Z",
    tags: ["personal-growth", "memoir"],
    readTimeMinutes: 6,
  },
  {
    slug: "how-fechi-organics-got-its-first-100-customers",
    title: "How Fechi Organics Got Its First 100 Customers",
    excerpt:
      "No ads, no investors — just a market stall, a shea butter recipe, and a lot of uncomfortable conversations about price.",
    content:
      "I did not have a marketing budget. I had a table at the Karen Saturday market and a willingness to embarrass myself asking strangers to smell my elbow...",
    coverImage: "/blog/first-100-customers/cover.jpg",
    author: "Felister \"Wangechi\" Kariuki",
    publishedAt: "2025-05-18T09:00:00.000Z",
    tags: ["entrepreneurship", "small-business"],
    readTimeMinutes: 8,
  },
  {
    slug: "writing-a-memoir-while-still-living-it",
    title: "Writing a Memoir While You're Still Living It",
    excerpt:
      "Some chapters of From Pieces To Power were written before I knew how the story ended. Here's how that changed the book.",
    content:
      "There's a specific vertigo to writing about a wound that hasn't closed yet. I want to walk you through how I handled it...",
    coverImage: "/blog/writing-a-memoir/cover.jpg",
    author: "Felister \"Wangechi\" Kariuki",
    publishedAt: "2025-07-11T09:00:00.000Z",
    tags: ["writing", "memoir"],
    readTimeMinutes: 5,
  },
  {
    slug: "pricing-without-apologizing",
    title: "Pricing Without Apologizing",
    excerpt:
      "A practical breakdown of the pricing framework from The Shea Ledger, with real numbers from Fechi Organics's first year.",
    content:
      "Cost-plus pricing nearly killed my margins. Here's the three-part framework I use now, with the actual spreadsheet numbers...",
    coverImage: "/blog/pricing-without-apologizing/cover.jpg",
    author: "Felister \"Wangechi\" Kariuki",
    publishedAt: "2025-10-05T09:00:00.000Z",
    tags: ["entrepreneurship", "finance"],
    readTimeMinutes: 7,
  },
];

export function findBlogPostBySlug(slug: string): BlogPost | undefined {
  return MOCK_BLOG_POSTS.find((p) => p.slug === slug);
}
