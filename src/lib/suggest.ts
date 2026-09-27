import { drinkAvailability, requiredIngredientIds, type CabinetDrink } from "./cabinet";

/**
 * "What should we try next?" -- a simple, explainable ranking of the drinks
 * we haven't tried:
 *
 *  1. Taste: drinks sharing ingredients with ones we rated above our own
 *     average score higher; sharing with ones we rated below it, lower.
 *     Similarity is the overlap of required (non-staple) ingredients
 *     (Jaccard), and the result is a weighted average shrunk toward 0 when
 *     there's little overlap, so it's in "rating points above our average".
 *  2. Convenience (signed in only): a bonus if our bar has everything, a
 *     smaller one if it's one ingredient away.
 *  3. Ties go to Difford's rank.
 */

export interface SuggestDrink extends CabinetDrink {
  avgRating: number | null;
}

export interface Suggestion<D extends SuggestDrink = SuggestDrink> {
  drink: D;
  score: number;
  /** The rated drink it's most like (only one we rated above our average), and what they share. */
  like: { drink: D; shared: string[] } | null;
  /** From the bar cabinet; null when we don't know (signed out). */
  missing: string[] | null;
}

export const MAKEABLE_BONUS = 1;
export const ONE_AWAY_BONUS = 0.3;

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let both = 0;
  for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}

export function suggestNext<D extends SuggestDrink>(
  drinks: D[],
  { have = null, limit = 10 }: { have?: Set<string> | null; limit?: number } = {}
): Suggestion<D>[] {
  const ids = new Map(drinks.map((d) => [d.slug, requiredIngredientIds(d.ingredientTexts)]));
  const rated = drinks.filter((d) => d.tried && d.avgRating !== null);
  const mean = rated.length > 0 ? rated.reduce((sum, d) => sum + d.avgRating!, 0) / rated.length : 0;

  const out: Suggestion<D>[] = [];
  for (const d of drinks) {
    if (d.tried) continue;
    const mine = ids.get(d.slug)!;
    let weighted = 0;
    let weights = 0;
    let best: { drink: D; pull: number } | null = null;
    for (const r of rated) {
      const j = jaccard(mine, ids.get(r.slug)!);
      if (j === 0) continue;
      const pull = j * (r.avgRating! - mean);
      weighted += pull;
      weights += j;
      if (pull > 0 && (!best || pull > best.pull)) best = { drink: r, pull };
    }
    const taste = weighted / (weights + 1);

    let missing: string[] | null = null;
    let convenience = 0;
    if (have) {
      const a = drinkAvailability(d, have);
      missing = a.unknown.length > 0 ? null : a.missing;
      if (missing?.length === 0) convenience = MAKEABLE_BONUS;
      else if (missing?.length === 1) convenience = ONE_AWAY_BONUS;
    }

    out.push({
      drink: d,
      score: taste + convenience,
      like: best ? { drink: best.drink, shared: [...mine].filter((x) => ids.get(best!.drink.slug)!.has(x)) } : null,
      missing,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.drink.diffordsRank - b.drink.diffordsRank).slice(0, limit);
}
