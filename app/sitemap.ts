import type { MetadataRoute } from "next";

import { listBooks } from "@/lib/catalogue";
import { SITE } from "@/lib/site";

export const revalidate = 3600;

/** Public pages only. Cart, checkout, account, dashboard and admin are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ["", "/about", "/store", "/services", "/contact", "/terms", "/privacy", "/refunds", "/cookies"].map((path) => ({ url: `${SITE.url}${path}` }));
  const books = await listBooks().catch(() => []); // a database outage must not break the sitemap
  return [...fixed, ...books.map((b) => ({ url: `${SITE.url}/store/${b.slug}` }))];
}
