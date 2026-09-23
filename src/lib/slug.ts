/**
 * Turns a cocktail name into a URL-safe slug for its recipe-card route
 * (/cocktails/[slug]). Used once to generate the `cocktails.slug` column
 * (supabase/migrations/0002_add_cocktail_slug.sql); at runtime the app
 * reads the stored slug from the DB rather than recomputing it, so a URL
 * stays stable even if a display name is later corrected.
 *
 *   "Près du Quai"          -> "pres-du-quai"
 *   "3 Monkeys & a dash"    -> "3-monkeys-and-a-dash"
 *   "Shark's Tooth (by Don Beach)" -> "sharks-tooth-by-don-beach"
 */
/** Shape of every valid slug; mirrors the DB's cocktails_slug_format check. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents (è -> e)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['‘’]/g, "") // drop apostrophes: shark's -> sharks
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
