import "server-only";
import { headers } from "next/headers";

/**
 * This site's origin, for links in auth emails and invite links. Prefers a
 * configured URL (NEXT_PUBLIC_SITE_URL, else Vercel's production domain)
 * over request headers; Supabase additionally only honors allow-listed
 * redirect URLs.
 */
export async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return requestOrigin();
}

/**
 * Where links to this same deployment should point, for invite links: the
 * live domain in production, but the preview's own address on a preview
 * (VERCEL_PROJECT_PRODUCTION_URL is set there too, and would send staging
 * invites to the live site, which has none of staging's invites).
 */
export async function appLinkOrigin(): Promise<string> {
  return process.env.VERCEL_ENV === "production" ? siteOrigin() : requestOrigin();
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
