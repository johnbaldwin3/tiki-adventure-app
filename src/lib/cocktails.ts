import { supabase } from "./supabase";
import type { TastingRecord } from "./tasting";

export interface CocktailRecord extends TastingRecord {
  slug: string;
  diffordsRank: number;
  primarySpirits: string[];
  diffordsGuideUrl: string;
}

interface RawCocktailRow {
  id: string;
  name: string;
  slug: string;
  diffords_rank: number;
  diffords_guide_url: string;
  primary_spirits: string[] | null;
}

interface RawTastingRow {
  cocktail_id: string;
  // PostgREST serializes Postgres `numeric` columns as JSON strings (to
  // avoid float precision loss), so tastings.rating comes back as e.g.
  // "8.59", not 8.59, despite the DB column being numeric(4,2). Must be
  // coerced with Number() below before it reaches averageRating/rankCocktails,
  // which both filter on typeof v === "number".
  rating: number | string | null;
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

    const numericRating =
      row.rating === null || row.rating === undefined ? null : Number(row.rating);
    const safeRating =
      numericRating !== null && Number.isNaN(numericRating) ? null : numericRating;

    if (initials === "JB") existing.jbRating = safeRating;
    if (initials === "GM") existing.gmRating = safeRating;
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
        slug: c.slug,
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
      .select("id, name, slug, diffords_rank, diffords_guide_url, primary_spirits")
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

// ---------------------------------------------------------------------------
// Recipe card detail (Phase 3)
// ---------------------------------------------------------------------------

export interface Ingredient {
  amount: string;
  unit: string;
  ingredient: string;
}

export interface TasterEntry {
  initials: string;
  displayName: string;
  tried: boolean;
  rating: number | null;
  notes: string | null;
  tastedAt: string | null;
}

export interface CocktailDetail {
  name: string;
  slug: string;
  diffordsRank: number;
  diffordsGuideUrl: string;
  primarySpirits: string[];
  glass: string | null;
  garnish: string | null;
  methodSummary: string | null;
  ingredients: Ingredient[];
  /** One entry per known taster (JB, GM), in that order, even if they haven't tasted it. */
  tasters: TasterEntry[];
}

export interface RawCocktailDetailRow extends RawCocktailRow {
  glass: string | null;
  garnish: string | null;
  method_summary: string | null;
  ingredients: unknown;
}

export interface RawTasterRow {
  id: string;
  initials: string;
  display_name: string;
}

export interface RawDetailTastingRow {
  taster_id: string;
  rating: number | string | null;
  notes: string | null;
  tried: boolean;
  tasted_at: string | null;
}

/** Same numeric-string coercion as mapRowsToCocktailRecords (see RawTastingRow). */
function toRating(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/**
 * The `ingredients` jsonb column is typed `unknown` coming off the wire;
 * keep only well-formed {amount, unit, ingredient} entries, in pour order.
 */
export function parseIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as Record<string, unknown>).ingredient === "string" &&
        ((v as Record<string, unknown>).ingredient as string).trim() !== ""
    )
    .map((v) => ({
      amount:
        typeof v.amount === "string" ? v.amount : typeof v.amount === "number" ? String(v.amount) : "",
      unit: typeof v.unit === "string" ? v.unit : "",
      ingredient: v.ingredient as string,
    }));
}

/** Preferred display order for tasters; anyone else sorts after, by initials. */
const TASTER_ORDER = ["JB", "GM"];

/**
 * Pure reshaping for the recipe card: the cocktail row plus its tastings,
 * with every known taster represented (an untasted entry if they have no
 * tastings row yet) so the card can always show both JB and GM.
 */
export function mapRowsToCocktailDetail(
  cocktailRow: RawCocktailDetailRow,
  tasterRows: RawTasterRow[],
  tastingRows: RawDetailTastingRow[]
): CocktailDetail {
  const tastingByTaster = new Map(tastingRows.map((t) => [t.taster_id, t]));

  const orderOf = (initials: string) => {
    const i = TASTER_ORDER.indexOf(initials);
    return i === -1 ? TASTER_ORDER.length : i;
  };

  const tasters = tasterRows
    .slice()
    .sort((a, b) => orderOf(a.initials) - orderOf(b.initials) || a.initials.localeCompare(b.initials))
    .map((taster) => {
      const t = tastingByTaster.get(taster.id);
      return {
        initials: taster.initials,
        displayName: taster.display_name,
        tried: t?.tried ?? false,
        rating: toRating(t?.rating),
        notes: t?.notes?.trim() ? t.notes.trim() : null,
        tastedAt: t?.tasted_at ?? null,
      };
    });

  return {
    name: cocktailRow.name,
    slug: cocktailRow.slug,
    diffordsRank: cocktailRow.diffords_rank,
    diffordsGuideUrl: cocktailRow.diffords_guide_url,
    primarySpirits: cocktailRow.primary_spirits ?? [],
    glass: cocktailRow.glass,
    garnish: cocktailRow.garnish,
    methodSummary: cocktailRow.method_summary,
    ingredients: parseIngredients(cocktailRow.ingredients),
    tasters,
  };
}

/**
 * Fetches one cocktail's full recipe + tastings by slug. Returns null when
 * no cocktail has that slug (the page turns that into a 404).
 */
export async function fetchCocktailBySlug(slug: string): Promise<CocktailDetail | null> {
  const [{ data: cocktailRow, error: cocktailError }, { data: tasterRows, error: tastersError }] =
    await Promise.all([
      supabase
        .from("cocktails")
        .select(
          "id, name, slug, diffords_rank, diffords_guide_url, primary_spirits, glass, garnish, method_summary, ingredients"
        )
        .eq("slug", slug)
        .maybeSingle(),
      supabase.from("tasters").select("id, initials, display_name"),
    ]);

  if (cocktailError) {
    throw new Error(`Failed to fetch cocktail: ${cocktailError.message}`);
  }
  if (tastersError) {
    throw new Error(`Failed to fetch tasters: ${tastersError.message}`);
  }
  if (!cocktailRow) return null;

  const { data: tastingRows, error: tastingsError } = await supabase
    .from("tastings")
    .select("taster_id, rating, notes, tried, tasted_at")
    .eq("cocktail_id", (cocktailRow as RawCocktailDetailRow).id);

  if (tastingsError) {
    throw new Error(`Failed to fetch tastings: ${tastingsError.message}`);
  }

  return mapRowsToCocktailDetail(
    cocktailRow as RawCocktailDetailRow,
    (tasterRows ?? []) as RawTasterRow[],
    (tastingRows ?? []) as RawDetailTastingRow[]
  );
}
