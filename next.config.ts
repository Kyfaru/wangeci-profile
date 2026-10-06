import type { NextConfig } from "next";

// Anything that is not the real production domain must stay out of search engines.
const isProductionSite = process.env.NEXT_PUBLIC_SITE_ENV === "production";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" }, // legacy twin of CSP frame-ancestors (set in proxy.ts)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  ...(isProductionSite ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Standalone output so the Dockerfile (owned by devops) can copy a
  // minimal server bundle instead of the full node_modules tree. Vercel
  // produces its own optimized output and doesn't expect the standalone
  // layout (its build step fails looking for .next/next-server.js.nft.json
  // when this is set) — `VERCEL` is set automatically in Vercel's build
  // environment, so this only applies standalone mode for the Docker path.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    remotePatterns: [
      {
        // Placeholder R2 public-bucket domain shape (Cloudflare R2's
        // default public dev domain looks like pub-<hash>.r2.dev).
        // TODO: tighten this to the real bucket domain once the R2
        // public bucket is provisioned — this wildcard is intentionally
        // broad only until then.
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
};

export default nextConfig;
