/**
 * Pages a signed-out visitor may open: the landing page and the sign-in /
 * account pages. Everything else (recipes are copyrighted, ratings are
 * private) needs a member; src/proxy.ts sends visitors to sign in. The
 * database agrees (migration 0018: no anon reads).
 */
const PUBLIC_PAGES = new Set(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/manifest.webmanifest", "/robots.txt"]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || pathname.startsWith("/auth/") || /^\/(icon|apple-icon)\b/.test(pathname);
}
