import { supabase } from "./supabase";
import type { TastingRecord } from "./tasting";

export interface CocktailRecord extends TastingRecord {
  diffordsRank: number;
  primarySpirits: string[];
  diffordsGuideUrl: string;
}

interface RawCocktailRow {
  id: string;
  name: string;
  diffords_rank: number;
  diffords_guide_url: string;
  primary_spirits: string[] | null;
}

interface RawTastingRow {
  cocktail_id: string;
  rating: number | null;
  tried: boolean;
  tasters: { initials: string } | { initials: string }[] | null;
}

/**
 * Pure reshaping step, kept separate from the network call so it can be
 * unit-tested without hitting Supabase. Folds the normalized
 * cocktails + tastings rows (one tastings row per cocktail x taster) into
 * the flat TastingRecord shape that src/lib/tasting.ts's
 * rankCocktails/summarizeProgress already expect and have tests for.
 */
export function mapRowsToCocktailRecords(
  cocktailRows: RawCocktailRow[],
  tastingRows: RawTastingRow[]
): CocktailRecord[] {
  const tastingsByCocktail = new Map<
    string,
    { jbRating: number | null; gmRating: number | null; tried: boolean }
  >();

  for (const row of tastingRows) {
    const tasterEntry = Array.isArray(row.tasters) ? row.tasters[0] : row.tasters;
    const initials = tasterEntry?.initials;
    if (!initials) continue;

    const existing =
      tastingsByCocktail.get(row.cocktail_id) ?? {
        jbRating: null,
        gmRating: null,
        tried: false,
      };

    if (initials === "JB") existing.jbRating = row.rating;
    if (initials === "GM") existing.gmRating = row.rating;
    existing.tried = existing.tried || row.tried;

    tastingsByCocktail.set(row.cocktail_id, existing);
  }

  return cocktailRows
    .slice()
    .sort((a, b) => a.diffords_rank - b.diffords_rank)
    .map((c) => {
      const t = tastingsByCocktail.get(c.id);
      return {
        name: c.name,
        diffordsRank: c.diffords_rank,
        diffordsGuideUrl: c.diffords_guide_url,
        primarySpirits: c.primary_spirits ?? [],
        tried: t?.tried ?? false,
        jbRating: t?.jbRating ?? null,
        gmRating: t?.gmRating ?? null,
      };
    });
}

/**
 * Fetches all cocktails and their tastings from Supabase and reshapes them
 * into CocktailRecord[]. Runs both queries in parallel since neither
 * depends on the other's result.
 */
export async function fetchCocktailRecords(): Promise<CocktailRecord[]> {
  const [
    { data: cocktailRows, error: cocktailsError },
    { data: tastingRows, error: tastingsError },
  ] = await Promise.all([
    supabase
      .from("cocktails")
      .select("id, name, diffords_rank, diffords_guide_url, primary_spirits")
      .order("diffords_rank", { ascending: true }),
    supabase.from("tastings").select("cocktail_id, rating, tried, tasters(initials)"),
  ]);

  if (cocktailsError) {
    throw new Error(`Failed to fetch cocktails: ${cocktailsError.message}`);
  }
  if (tastingsError) {
    throw new Error(`Failed to fetch tastings: ${tastingsError.message}`);
  }

  return mapRowsToCocktailRecords(
    (cocktailRows ?? []) as RawCocktailRow[],
    (tastingRows ?? []) as unknown as RawTastingRow[]
  );
}
