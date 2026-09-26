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
}: {
  show?: ListFilter;
  ing?: string[];
  match?: IngredientMatch;
}): string {
  const params = new URLSearchParams();
  if (show !== "all") params.set("show", show);
  if (ing.length > 0) params.set("ing", ing.join(","));
  if (ing.length > 1 && match === "any") params.set("match", "any");
  const qs = params.toString().replace(/%2C/g, ",");
  return qs ? `/?${qs}` : "/";
}
