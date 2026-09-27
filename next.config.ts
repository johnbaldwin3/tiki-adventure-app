import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Playwright e2e build (which inlines mock Supabase env vars)
  // use its own output dir instead of overwriting the normal .next build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      // The recipe helper's photo import sends a resized photo (a few
      // hundred KB, capped client-side) to a Server Action; the default is 1MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
