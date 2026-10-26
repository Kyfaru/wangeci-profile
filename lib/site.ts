/**
 * One place for the site's identity. Every title, schema.org block, alt text
 * and email reads from here, so the author's name is spelled in one spot.
 * TODO(client): confirm the canonical spelling and fill the null contact
 * values below (null = hidden in production, shown as TODO(client) elsewhere).
 */
const siteEnv = process.env.NEXT_PUBLIC_SITE_ENV ?? (process.env.NODE_ENV === "production" ? "staging" : "development");

/**
 * Whether launch-only services (Upstash, QStash, Daraja, Turnstile, cron secret) may be missing.
 * Fails closed: a production build is strict unless NEXT_PUBLIC_SITE_ENV is explicitly "staging",
 * so forgetting the variable on the real site can never switch the safeguards off.
 * Pure on purpose: reads only NODE_ENV and NEXT_PUBLIC_*, so client code and tests can import it.
 */
export function isRelaxed(nodeEnv: string | undefined = process.env.NODE_ENV, site: string | undefined = process.env.NEXT_PUBLIC_SITE_ENV): boolean {
  return nodeEnv !== "production" || site === "staging";
}

export const SITE = {
  /** "production" | "staging" | "development". Only production is indexed. */
  env: siteEnv,
  isProduction: siteEnv === "production",
  /** True only in development/test or on an explicitly declared staging site. See isRelaxed. */
  relaxed: isRelaxed(),
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
