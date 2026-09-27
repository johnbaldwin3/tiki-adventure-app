import { getIngredient, resolveIngredient } from "./ingredients";

/**
 * Pure "what can we make?" logic for the bar cabinet.
 *
 * A drink's requirements are its catalog ingredients, minus staples (fresh
 * citrus, water/soda/salt, Angostura -- assumed always on hand) and minus
 * lines the recipe marks "(optional)". If an ingredient appears both as
 * optional and required in one recipe, it's required.
 */

export interface CabinetDrink {
  slug: string;
  name: string;
  diffordsRank: number;
  tried: boolean;
  ingredientTexts: string[];
}

export function requiredIngredientIds(ingredientTexts: string[]): Set<string> {
  const required = new Set<string>();
  for (const text of ingredientTexts) {
    const r = resolveIngredient(text);
    if (!r || r.optional || r.ingredient.staple) continue;
    required.add(r.ingredient.id);
  }
  return required;
}

/**
 * Required recipe lines the catalog doesn't recognise (e.g. a recipe edited
 * in the database after the catalog was written). We can't tell whether
 * they're on the shelf, so a drink with any is never shown as ready.
 */
export function unrecognisedLines(ingredientTexts: string[]): string[] {
  return ingredientTexts.filter((t) => !resolveIngredient(t) && !/\(optional\)/i.test(t));
}

export interface DrinkAvailability<D extends CabinetDrink = CabinetDrink> {
  drink: D;
  missing: string[]; // catalog ids, in recipe order
  /** Required lines the catalog doesn't know; if any, we can't say it's makeable. */
  unknown: string[];
}

export function drinkAvailability<D extends CabinetDrink>(drink: D, have: Set<string>): DrinkAvailability<D> {
  const missing = [...requiredIngredientIds(drink.ingredientTexts)].filter((id) => !have.has(id));
  return { drink, missing, unknown: unrecognisedLines(drink.ingredientTexts) };
}

export interface CabinetSummary<D extends CabinetDrink = CabinetDrink> {
  /** Everything required is in the cabinet. */
  ready: D[];
  /** Exactly one required ingredient missing. */
  oneAway: { drink: D; missingId: string }[];
  /**
   * Single bottles that would each complete the most drinks (from the
   * one-away list), best first. Ties break by name.
   */
  buyNext: { ingredientId: string; unlocks: D[] }[];
}

export function summarizeCabinet<D extends CabinetDrink>(drinks: D[], have: Set<string>): CabinetSummary<D> {
  const byRank = (a: D, b: D) => a.diffordsRank - b.diffordsRank;
  const ready: D[] = [];
  const oneAway: { drink: D; missingId: string }[] = [];
  for (const d of drinks) {
    const { missing, unknown } = drinkAvailability(d, have);
    if (unknown.length > 0) continue;
    if (missing.length === 0) ready.push(d);
    else if (missing.length === 1) oneAway.push({ drink: d, missingId: missing[0] });
  }
  ready.sort(byRank);
  oneAway.sort((a, b) => byRank(a.drink, b.drink));

  const unlocks = new Map<string, D[]>();
  for (const { drink, missingId } of oneAway) unlocks.set(missingId, [...(unlocks.get(missingId) ?? []), drink]);
  const name = (id: string) => getIngredient(id)?.name ?? id;
  const buyNext = [...unlocks.entries()]
    .map(([ingredientId, ds]) => ({ ingredientId, unlocks: ds }))
    .sort((a, b) => b.unlocks.length - a.unlocks.length || name(a.ingredientId).localeCompare(name(b.ingredientId)));

  return { ready, oneAway, buyNext };
}

export const BOTTLE_MAX_LENGTH = 120;

/**
 * Cleans a submitted bottle name: collapsed spaces, trimmed, at most 120
 * characters (counted by code point, so an emoji is never cut in half),
 * empty -> null.
 */
export function normalizeBottle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = Array.from(raw.replace(/\s+/g, " ").trim()).slice(0, BOTTLE_MAX_LENGTH).join("").trim();
  return v === "" ? null : v;
}

/** What the edit form submitted, read loosely (Server Actions can be POSTed to directly). */
export interface CabinetFormValues {
  have: string[];
  bottles: Record<string, string>;
}

export function readCabinetForm(form: { getAll(name: string): unknown[]; get(name: string): unknown }, isListed: (id: string) => boolean): CabinetFormValues {
  const have = [...new Set(form.getAll("have").filter((v): v is string => typeof v === "string" && isListed(v)))];
  const bottles: Record<string, string> = {};
  for (const id of have) bottles[id] = normalizeBottle(form.get(`bottle:${id}`)) ?? "";
  return { have, bottles };
}

export interface CabinetSavePlan {
  /** Rows to insert or update (upsert), with their bottle. */
  upsert: { ingredientId: string; bottle: string | null }[];
  /** Rows to delete. */
  remove: string[];
}

/**
 * Turns a form submission into the smallest set of changes, comparing what
 * was ticked when the page loaded ("was", "was-bottle:<id>") with what's
 * ticked now. Only the rows this person actually changed are written, so
 * two tasters editing at the same time don't undo each other's changes.
 * Ids are limited to the listed (catalog, non-staple) ones.
 */
export function planCabinetSave(form: { getAll(name: string): unknown[]; get(name: string): unknown }, isListed: (id: string) => boolean): CabinetSavePlan {
  const ids = (name: string) =>
    new Set(form.getAll(name).filter((v): v is string => typeof v === "string" && isListed(v)));
  const have = ids("have");
  const was = ids("was");
  const upsert: CabinetSavePlan["upsert"] = [];
  for (const id of have) {
    const bottle = normalizeBottle(form.get(`bottle:${id}`));
    if (!was.has(id) || bottle !== normalizeBottle(form.get(`was-bottle:${id}`))) upsert.push({ ingredientId: id, bottle });
  }
  const remove = [...was].filter((id) => !have.has(id));
  return { upsert, remove };
}
