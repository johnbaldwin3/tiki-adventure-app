import type { CocktailRecord } from "./cocktails";
import type { RankedTastingRecord } from "./tasting";

export type ListFilter = "all" | "tasted" | "untasted";

export const LIST_FILTERS: { value: ListFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tasted", label: "Tasted" },
  { value: "untasted", label: "Not yet" },
];

/**
 * Reads the ?show= search param. Anything missing or unrecognized falls
 * back to "all" rather than erroring, so a mistyped URL still shows the list.
 */
export function parseListFilter(value: string | string[] | undefined): ListFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "tasted" || v === "untasted" ? v : "all";
}

export type ListedCocktail = CocktailRecord & Pick<RankedTastingRecord, "avgRating" | "rank">;

/**
 * Filters and orders the cocktail list:
 *  - "tasted": only tried cocktails, best-rated first (our rank), with
 *    tried-but-unrated ones after, in Difford's order
 *  - "untasted": only untried cocktails, in Difford's order
 *  - "all": all 100, in Difford's order
 */
export function filterCocktails(records: ListedCocktail[], filter: ListFilter): ListedCocktail[] {
  const byDiffords = (a: ListedCocktail, b: ListedCocktail) => a.diffordsRank - b.diffordsRank;

  if (filter === "untasted") {
    return records.filter((r) => !r.tried).sort(byDiffords);
  }
  if (filter === "tasted") {
    return records
      .filter((r) => r.tried)
      .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || byDiffords(a, b));
  }
  return records.slice().sort(byDiffords);
}

// ---------------------------------------------------------------------------
// Ingredient filter (?ing=navy-rum,falernum&match=any)
// ---------------------------------------------------------------------------

export type IngredientMatch = "all" | "any";

/**
 * Reads ?ing= (comma-separated catalog ids, possibly repeated) plus an
 * optional ?add= from the picker form. Unknown ids are dropped; order is
 * kept (first chosen first) and duplicates removed.
 */
export function parseIngredientFilter(
  ing: string | string[] | undefined,
  add: string | string[] | undefined,
  isKnown: (id: string) => boolean
): string[] {
  const parts = [ing, add]
    .flat()
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => v !== "" && isKnown(v));
  return [...new Set(parts)];
}

export function parseIngredientMatch(value: string | string[] | undefined): IngredientMatch {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "any" ? "any" : "all";
}

/** Does a cocktail (given its catalog ingredient ids) satisfy the ingredient filter? */
export function matchesIngredients(cocktailIds: Set<string>, selected: string[], match: IngredientMatch): boolean {
  if (selected.length === 0) return true;
  return match === "all" ? selected.every((id) => cocktailIds.has(id)) : selected.some((id) => cocktailIds.has(id));
}

/** Builds a home-list URL, omitting defaults so links stay short and canonical. */
export function listHref({
  show = "all",
  ing = [],
  match = "all",
  q = "",
}: {
  show?: ListFilter;
  ing?: string[];
  match?: IngredientMatch;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (q !== "") params.set("q", q);
  if (show !== "all") params.set("show", show);
  if (ing.length > 0) params.set("ing", ing.join(","));
  if (ing.length > 1 && match === "any") params.set("match", "any");
  const qs = params.toString().replace(/%2C/g, ",");
  return qs ? `/?${qs}` : "/";
}

// ---------------------------------------------------------------------------
// Search (?q=mai tai)
// ---------------------------------------------------------------------------

export const SEARCH_MAX_LENGTH = 60;

/** Reads ?q=: collapsed spaces, trimmed, capped at 60 characters; "" when absent or unsearchable. */
export function parseSearch(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (typeof v !== "string") return "";
  const q = Array.from(v.replace(/\s+/g, " ").trim()).slice(0, SEARCH_MAX_LENGTH).join("").trim();
  // Nothing searchable (e.g. only emoji or punctuation) counts as no search.
  return foldForSearch(q) === "" ? "" : q;
}

/** Lowercase, accents and punctuation folded away: "Piña" -> "pina", "Mai-Tai" -> "mai tai". */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['‘’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Does a cocktail match the search? Every word must appear (as the start of
 * a word) somewhere in its name, primary spirits or ingredients -- so
 * "jamaican falernum" finds drinks with both, and "rum" doesn't match
 * "drum". `haystack` is the pre-folded searchable text.
 */
export function matchesSearch(haystack: string, q: string): boolean {
  const words = foldForSearch(q).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const padded = ` ${haystack} `;
  return words.every((w) => padded.includes(` ${w}`));
}

/** The folded text a cocktail is searched by. */
export function searchText(parts: { name: string; primarySpirits: string[]; ingredients: string[] }): string {
  return foldForSearch([parts.name, ...parts.primarySpirits, ...parts.ingredients].join(" | "));
}
