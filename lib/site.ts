/**
 * One place for the site's identity. Every title, schema.org block, alt text
 * and email reads from here, so the author's name is spelled in one spot.
 * TODO(client): confirm the canonical spelling and fill the null contact
 * values below (null = hidden in production, shown as TODO(client) elsewhere).
 */
const siteEnv = process.env.NEXT_PUBLIC_SITE_ENV ?? (process.env.NODE_ENV === "production" ? "staging" : "development");

export const SITE = {
  /** "production" | "staging" | "development". Only production is indexed. */
  env: siteEnv,
  isProduction: siteEnv === "production",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  brand: "Wangeci",
  authorName: "Wangeci Kariuki",
  bookTitle: "From Pieces To Power",
  description:
    "Author and entrepreneur Wangeci Kariuki, a former Kameme TV journalist, and her memoir From Pieces To Power.",
  contact: {
    email: null as string | null, // TODO(client)
    phone: null as string | null, // TODO(client)
    place: null as string | null, // TODO(client)
  },
} as const;

export const SITE_TITLE = `${SITE.authorName} | Author & Entrepreneur`;
