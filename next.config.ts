import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output so the Dockerfile (owned by devops) can copy a
  // minimal server bundle instead of the full node_modules tree.
  output: "standalone",
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
