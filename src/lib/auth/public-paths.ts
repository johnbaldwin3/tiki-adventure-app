/**
 * Pages a signed-out visitor may open: the landing page, the how-it-works
 * guide (no recipes in it), the sign-in / account pages and invite links (/join/<token>). Everything else (recipes are copyrighted, ratings are
 * private) needs a member; src/proxy.ts sends visitors to sign in. The
 * database agrees (migration 0018: no anon reads).
 */
const PUBLIC_PAGES = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/guide", "/manifest.webmanifest", "/robots.txt"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || pathname.startsWith("/auth/") || pathname.startsWith("/join/") || /^\/(icon|apple-icon)\b/.test(pathname);
}
