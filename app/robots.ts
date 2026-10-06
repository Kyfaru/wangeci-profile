import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Staging and previews must never compete with the real domain in search results.
  if (!SITE.isProduction) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/checkout", "/account", "/admin", "/cart", "/sign-in", "/sign-up", "/verify"] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
