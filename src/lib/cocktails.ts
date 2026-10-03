import { collectionSlugsByCocktail } from "./collections";
import { fetchCollections } from "./collections-data";
import { applyStyleOverrides, computeStyles, type StyleOverride } from "./styles";
import { fetchStyleOverrides } from "./styles-data";
import { byListOrder } from "./order";
import { supabase } from "./supabase";
import type { TastingRecord } from "./tasting";

/** diffords: Difford's Top 100 (tiki); iba: the IBA official list; ours: added by JB & GM. */
export type CocktailSource = "diffords" | "ours" | "iba";

export interface CocktailRecord extends TastingRecord {
  slug: string;
  /** Each recipe line's ingredient wording, in pour order (see src/data/ingredients.ts). */
  ingredientTexts: string[];
  /** Explicit catalog ids per line (set on our own recipes), index-aligned with ingredientTexts. */
  ingredientIds: (string | null)[];
  /** Difford's Top 100 rank; null for recipes we added ourselves. */
  diffordsRank: number | null;
  primarySpirits: string[];
  diffordsGuideUrl: string | null;
  source: CocktailSource;
  /** One of our recipes that's a best guess (e.g. from a menu), not tested yet. */
  isGuess?: boolean;
  /** Database id (joins collection memberships). */
  id?: string;
  /** Slugs of the collections it's in, in collection order. */
  collections?: string[];
  /** Style tag ids (computed from the ingredients, with any taster fixes). */
  styles?: string[];
}

interface RawCocktailRow {
  id: string;
  name: string;
  slug: string;
  diffords_rank: number | null;
  diffords_guide_url: string | null;
  primary_spirits: string[] | null;
  ingredients?: unknown;
  source?: string | null;
  is_guess?: boolean | null;
}

function toSource(value: unknown, diffordsRank: number | null): CocktailSource {
  if (value === "ours" || value === "diffords" || value === "iba") return value;
  return diffordsRank === null ? "ours" : "diffords";
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
  tastingRows: RawTastingRow[],
  collectionsByCocktail: Map<string, string[]> = new Map(),
  styleOverrides: Map<string, StyleOverride[]> = new Map()
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
    .sort((a, b) => byListOrder({ diffordsRank: a.diffords_rank, name: a.name }, { diffordsRank: b.diffords_rank, name: b.name }))
    .map((c) => {
      const t = tastingsByCocktail.get(c.id);
      const lines = parseIngredients(c.ingredients);
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        collections: collectionsByCocktail.get(c.id) ?? [],
        styles: applyStyleOverrides(computeStyles(lines), styleOverrides.get(c.id) ?? []),
        diffordsRank: c.diffords_rank,
        diffordsGuideUrl: c.diffords_guide_url,
        primarySpirits: c.primary_spirits ?? [],
        ingredientTexts: lines.map((i) => i.ingredient),
        ingredientIds: lines.map((i) => i.catalogId),
        source: toSource(c.source, c.diffords_rank),
        isGuess: c.is_guess === true,
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
    { collections, memberships },
    styleOverrides,
  ] = await Promise.all([
    supabase
      .from("cocktails")
      .select("id, name, slug, diffords_rank, diffords_guide_url, primary_spirits, ingredients, source, is_guess")
      .order("diffords_rank", { ascending: true, nullsFirst: false }),
    supabase.from("tastings").select("cocktail_id, rating, tried, tasters(initials)"),
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
  ]);

  if (cocktailsError) {
    throw new Error(`Failed to fetch cocktails: ${cocktailsError.message}`);
  }
  if (tastingsError) {
    throw new Error(`Failed to fetch tastings: ${tastingsError.message}`);
  }

  return mapRowsToCocktailRecords(
    (cocktailRows ?? []) as RawCocktailRow[],
    (tastingRows ?? []) as unknown as RawTastingRow[],
    collectionSlugsByCocktail(collections, memberships),
    styleOverrides
  );
}

// ---------------------------------------------------------------------------
// Recipe card detail
// ---------------------------------------------------------------------------

export interface Ingredient {
  amount: string;
  unit: string;
  ingredient: string;
  /** Catalog style id, set on lines of our own recipes (null otherwise). */
  catalogId: string | null;
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
  id: string;
  name: string;
  slug: string;
  source: CocktailSource;
  diffordsRank: number | null;
  diffordsGuideUrl: string | null;
  /** Where one of our recipes came from. */
  sourceUrl: string | null;
  sourceNote: string | null;
  /** Initials of the taster who added it (our recipes). */
  addedBy: string | null;
  /** A best guess (e.g. from a menu), not a tested recipe. */
  isGuess: boolean;
  primarySpirits: string[];
  glass: string | null;
  garnish: string | null;
  methodSummary: string | null;
  ingredients: Ingredient[];
  /** One entry per known taster (JB, GM), in that order, even if they haven't tasted it. */
  tasters: TasterEntry[];
}

export interface RawCocktailDetailRow extends RawCocktailRow {
  source_url?: string | null;
  source_note?: string | null;
  added_by?: string | null;
  is_guess?: boolean | null;
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
      catalogId: typeof v.catalog_id === "string" && v.catalog_id !== "" ? v.catalog_id : null,
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
    id: cocktailRow.id,
    name: cocktailRow.name,
    slug: cocktailRow.slug,
    source: toSource(cocktailRow.source, cocktailRow.diffords_rank),
    diffordsRank: cocktailRow.diffords_rank,
    diffordsGuideUrl: cocktailRow.diffords_guide_url,
    sourceUrl: cocktailRow.source_url ?? null,
    sourceNote: cocktailRow.source_note ?? null,
    addedBy: tasterRows.find((t) => t.id === cocktailRow.added_by)?.initials ?? null,
    isGuess: cocktailRow.is_guess === true,
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
          "id, name, slug, diffords_rank, diffords_guide_url, primary_spirits, glass, garnish, method_summary, ingredients, source, source_url, source_note, added_by, is_guess"
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
