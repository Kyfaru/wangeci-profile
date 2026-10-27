import type { MetadataRoute } from "next";

import { listBooks } from "@/lib/catalogue";
import { SITE } from "@/lib/site";
import { traced } from "@/lib/trace";

export const dynamic = "force-dynamic"; // needs the database, which the build does not have

/** Public pages only. Cart, checkout, account, dashboard and admin are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ["", "/about", "/store", "/services", "/contact", "/terms", "/privacy", "/refunds", "/cookies"].map((path) => ({ url: `${SITE.url}${path}` }));
  // A database outage must not break the sitemap: traced, then the fixed pages alone.
  const books = (await traced("sitemap.books", () => listBooks())) ?? [];
  return [...fixed, ...books.map((b) => ({ url: `${SITE.url}/store/${b.slug}` }))];
}
