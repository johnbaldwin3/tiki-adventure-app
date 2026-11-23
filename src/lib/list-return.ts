/**
 * "Back to the list" memory: when a taster opens a recipe card from the home
 * list, we remember the list's URL (its filters) and how far down they had
 * scrolled, so "← All cocktails" and the browser's back button land them
 * where they were instead of at the top of an unfiltered list.
 *
 * Kept in sessionStorage (one tab, gone when it closes). These helpers are
 * pure so they can be tested; the components do the storage and scrolling.
 */

export const LIST_RETURN_KEY = "equal-parts:list-return";

export interface ListReturn {
  /** The home list URL, path + query ("/" or "/?show=tasted&ing=..."). */
  href: string;
  /** window.scrollY when the card was opened. */
  y: number;
  /** The drink that was opened, to put focus back on its row. */
  slug: string | null;
  /** Set when the taster heads back, so only that visit restores the scroll. */
  restore: boolean;
}

/** Only the home list (never another page or another site). */
export function isListHref(href: string): boolean {
  return href === "/" || (href.startsWith("/?") && !href.includes("#"));
}

/** The card a link opens ("/cocktails/<slug>"), or null for any other link. */
export function cardSlug(href: string): string | null {
  const m = /^\/cocktails\/([a-z0-9-]+)\/?(?:[?#].*)?$/.exec(href);
  return m && m[1] !== "new" ? m[1] : null;
}

export function parseListReturn(raw: string | null): ListReturn | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<ListReturn>;
    if (typeof v.href !== "string" || !isListHref(v.href)) return null;
    const y = typeof v.y === "number" && Number.isFinite(v.y) && v.y > 0 ? Math.round(v.y) : 0;
    const slug = typeof v.slug === "string" && cardSlug(`/cocktails/${v.slug}`) ? v.slug : null;
    return { href: v.href, y, slug, restore: v.restore === true };
  } catch {
    return null;
  }
}

/** Label for the back link: plain "All cocktails" unless the list was narrowed. */
export function backLabel(entry: ListReturn | null): string {
  return entry && entry.href !== "/" ? "Back to the list" : "All cocktails";
}
