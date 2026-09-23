import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the Playwright e2e build (which inlines mock Supabase env vars)
  // use its own output dir instead of overwriting the normal .next build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
