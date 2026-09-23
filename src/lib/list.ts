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
