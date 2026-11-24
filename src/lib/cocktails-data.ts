import "server-only";
import { collectionSlugsByCocktail } from "./collections";
import { fetchCollections } from "./collections-data";
import {
  mapRowsToCocktailDetail,
  mapRowsToCocktailRecords,
  type CocktailDetail,
  type CocktailRecord,
  type RawCocktailDetailRow,
  type RawCocktailRow,
  type RawDetailTastingRow,
  type RawTasterRow,
  type RawTastingRow,
} from "./cocktails";
import { householdSlots } from "./people";
import { getPeople } from "./people-data";
import { getReadClient } from "./read-client";
import type { StyleOverride } from "./styles";
import { fetchStyleOverrides } from "./styles-data";
import { fetchVersions } from "./versions-data";
import type { DrinkVersions } from "./versions";

/**
 * Fetches all cocktails and the tastings the viewer may see (RLS, migration
 * 0018: their household's and friends'; none when signed out) and reshapes
 * them into CocktailRecord[], with the household as the a/b rating columns.
 * Runs the queries in parallel since none depends on another's result.
 */
export async function fetchCocktailRecords(): Promise<CocktailRecord[]> {
  const db = await getReadClient();
  const [
    { data: cocktailRows, error: cocktailsError },
    { data: tastingRows, error: tastingsError },
    people,
    { collections, memberships },
    styleOverrides,
    versions,
  ] = await Promise.all([
    db
      .from("cocktails")
      .select("id, name, slug, diffords_rank, diffords_guide_url, primary_spirits, ingredients, source, is_guess")
      .order("diffords_rank", { ascending: true, nullsFirst: false }),
    // tastings has two keys to tasters (taster_id and entered_by, migration
    // 0016), so the embed must name the one it means or PostgREST refuses it.
    db.from("tastings").select("cocktail_id, rating, tried, tasters!tastings_taster_id_fkey(initials)"),
    getPeople(),
    // Collections are extra: if they can't load, the list still works (no collection tags).
    fetchCollections().catch((err) => {
      console.error("cocktails: failed to load collections", err);
      return { collections: [], memberships: [] };
    }),
    // Likewise style fixes: without them the computed tags still show.
    fetchStyleOverrides().catch((err) => {
      console.error("cocktails: failed to load style fixes", err);
      return new Map<string, StyleOverride[]>();
    }),
    // And our versions: without them every drink uses its original recipe.
    fetchVersions().catch((err) => {
      console.error("cocktails: failed to load our versions", err);
      return new Map<string, DrinkVersions>();
    }),
  ]);

  if (cocktailsError) {
    throw new Error(`Failed to fetch cocktails: ${cocktailsError.message}`);
  }
  if (tastingsError) {
    throw new Error(`Failed to fetch tastings: ${tastingsError.message}`);
  }

  return mapRowsToCocktailRecords((cocktailRows ?? []) as RawCocktailRow[], (tastingRows ?? []) as unknown as RawTastingRow[], {
    slots: householdSlots(people),
    collectionsByCocktail: collectionSlugsByCocktail(collections, memberships),
    styleOverrides,
    activeLines: new Map([...versions].flatMap(([id, v]) => (v.active ? [[id, v.active.ingredients] as const] : []))),
  });
}

/**
 * Fetches one cocktail's full recipe + the tastings the viewer may see, by
 * slug. Returns null when no cocktail has that slug, or it's someone's own
 * recipe the viewer can't see (the page turns that into a 404).
 */
export async function fetchCocktailBySlug(slug: string): Promise<CocktailDetail | null> {
  const db = await getReadClient();
  const [{ data: cocktailRow, error: cocktailError }, { data: tasterRows, error: tastersError }, people] =
    await Promise.all([
      db
        .from("cocktails")
        .select(
          "id, name, slug, diffords_rank, diffords_guide_url, primary_spirits, glass, garnish, method_summary, ingredients, source, source_url, source_note, added_by, is_guess"
        )
        .eq("slug", slug)
        .maybeSingle(),
      db.from("tasters").select("id, initials, display_name, household_id"),
      getPeople(),
    ]);

  if (cocktailError) {
    throw new Error(`Failed to fetch cocktail: ${cocktailError.message}`);
  }
  if (tastersError) {
    throw new Error(`Failed to fetch tasters: ${tastersError.message}`);
  }
  if (!cocktailRow) return null;

  const { data: tastingRows, error: tastingsError } = await db
    .from("tastings")
    .select("taster_id, rating, notes, tried, tasted_at, entered_by")
    .eq("cocktail_id", (cocktailRow as RawCocktailDetailRow).id);

  if (tastingsError) {
    throw new Error(`Failed to fetch tastings: ${tastingsError.message}`);
  }

  return mapRowsToCocktailDetail(
    cocktailRow as RawCocktailDetailRow,
    (tasterRows ?? []) as RawTasterRow[],
    (tastingRows ?? []) as RawDetailTastingRow[],
    people.me?.householdId ?? null
  );
}
