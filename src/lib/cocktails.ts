import { applyStyleOverrides, computeStyles, type StyleOverride } from "./styles";
import { byListOrder } from "./order";
import { byTasterOrder } from "./people";
import type { Rating, TastingRecord } from "./tasting";

/** diffords: Difford's Top 100 (tiki); iba: the IBA official list; ours: added by a household. */
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
  /** Initials of the tasters who've tried it (rated or not): household and friends. */
  triedBy?: string[];
  /** Every visible taster's rating, by initials (null: tried, not rated). */
  ratings?: Record<string, Rating>;
}

export interface RawCocktailRow {
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

export interface RawTastingRow {
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

export interface RecordOptions {
  /** Initials for the a/b rating columns (the household, see householdSlots). */
  slots?: readonly string[];
  collectionsByCocktail?: Map<string, string[]>;
  styleOverrides?: Map<string, StyleOverride[]>;
  /** "Our version" lines (a kept critique tweak), which replace the original's for bar/shopping/styles. */
  activeLines?: Map<string, Ingredient[]>;
}

/**
 * Pure reshaping step, kept separate from the network call so it can be
 * unit-tested without hitting Supabase. Folds the normalized
 * cocktails + tastings rows (one tastings row per cocktail x taster) into
 * the flat TastingRecord shape that src/lib/tasting.ts's
 * rankCocktails/summarizeProgress already expect and have tests for.
 * Only the household's ratings (slots) count toward aRating/bRating and so
 * the averages and ranks; friends' ratings are in `ratings` and `triedBy`.
 */
export function mapRowsToCocktailRecords(
  cocktailRows: RawCocktailRow[],
  tastingRows: RawTastingRow[],
  { slots = [], collectionsByCocktail = new Map(), styleOverrides = new Map(), activeLines = new Map() }: RecordOptions = {}
): CocktailRecord[] {
  const [slotA, slotB] = slots;
  const tastingsByCocktail = new Map<
    string,
    { ratings: Record<string, Rating>; tried: boolean; triedBy: string[] }
  >();

  for (const row of tastingRows) {
    const tasterEntry = Array.isArray(row.tasters) ? row.tasters[0] : row.tasters;
    const initials = tasterEntry?.initials;
    if (!initials) continue;

    const existing = tastingsByCocktail.get(row.cocktail_id) ?? { ratings: {}, tried: false, triedBy: [] };

    const numericRating =
      row.rating === null || row.rating === undefined ? null : Number(row.rating);
    const safeRating =
      numericRating !== null && Number.isNaN(numericRating) ? null : numericRating;

    existing.ratings[initials] = safeRating;
    existing.tried = existing.tried || (row.tried && slots.includes(initials));
    if (row.tried && !existing.triedBy.includes(initials)) existing.triedBy.push(initials);

    tastingsByCocktail.set(row.cocktail_id, existing);
  }

  return cocktailRows
    .slice()
    .sort((a, b) => byListOrder({ diffordsRank: a.diffords_rank, name: a.name }, { diffordsRank: b.diffords_rank, name: b.name }))
    .map((c) => {
      const t = tastingsByCocktail.get(c.id);
      const lines = activeLines.get(c.id) ?? parseIngredients(c.ingredients);
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
        triedBy: t?.triedBy ?? [],
        ratings: t?.ratings ?? {},
        aRating: slotA ? (t?.ratings[slotA] ?? null) : null,
        bRating: slotB ? (t?.ratings[slotB] ?? null) : null,
      };
    });
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
  /** In the viewer's household: always listed, and they can enter it. Friends are read-only. */
  household: boolean;
  displayName: string;
  /** Initials of whoever last saved this tasting, when it wasn't this taster. */
  enteredBy: string | null;
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
  /**
   * The viewer's household (always, even untasted), then any friend who has
   * tasted it. Empty when signed out.
   */
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
  household_id?: string | null;
}

export interface RawDetailTastingRow {
  taster_id: string;
  entered_by?: string | null;
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

/**
 * Pure reshaping for the recipe card: the cocktail row plus its tastings.
 * Household members are always listed (an untasted entry if they have no
 * tastings row yet) so the card can always offer them a rating; friends
 * only when they've tasted it. tasterRows is whoever RLS lets the viewer see.
 */
export function mapRowsToCocktailDetail(
  cocktailRow: RawCocktailDetailRow,
  tasterRows: RawTasterRow[],
  tastingRows: RawDetailTastingRow[],
  /** The viewer's household; null when signed out (no one is listed). */
  householdId: string | null
): CocktailDetail {
  const tastingByTaster = new Map(tastingRows.map((t) => [t.taster_id, t]));
  const mine = (t: RawTasterRow) => householdId !== null && t.household_id === householdId;

  const tasters = tasterRows
    .filter((taster) => householdId !== null && (mine(taster) || tastingByTaster.has(taster.id)))
    .sort((a, b) => Number(mine(b)) - Number(mine(a)) || byTasterOrder(a, b))
    .map((taster) => {
      const t = tastingByTaster.get(taster.id);
      return {
        initials: taster.initials,
        household: mine(taster),
        displayName: taster.display_name,
        enteredBy:
          t?.entered_by && t.entered_by !== taster.id
            ? (tasterRows.find((x) => x.id === t.entered_by)?.initials ?? null)
            : null,
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
