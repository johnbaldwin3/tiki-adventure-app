import { SC_CATEGORIES, SC_NOT_LISTED, SC_STYLE_MAP, type ScBottle, type ScCategory } from "@/data/smugglers-cove";

/**
 * Smuggler's Cove rum categories (src/data/smugglers-cove.ts): find a
 * bottle's category from its name, and the closest category for one of our
 * catalog rum styles.
 */

const BY_ID = new Map(SC_CATEGORIES.map((c) => [c.id, c]));

export const getScCategory = (id: string): ScCategory | undefined => BY_ID.get(id);

/** Lower-case words: accents off, "&" -> "and", "O.F.T.D." -> "oftd", "12yr" -> "12", "year"/"yo" dropped. */
export function normalizeBottle(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !["year", "years", "yr", "yrs", "yo", "old", "ans", "anos"].includes(w))
    .join(" ")
    .replace(/\brhum agricole\b ?/g, "")
    .trim();
}

/** Flavored and spiced rums aren't in the classification. */
const NOT_CLASSIFIED = /\b(spiced|coconut|pineapple|banana|flavou?red|liqueur|cream)\b/;

const NOT_LISTED = SC_NOT_LISTED.map(normalizeBottle);

const PATTERNS: { pattern: string; category: ScCategory; bottle: ScBottle }[] = SC_CATEGORIES.flatMap((category) =>
  category.bottles.flatMap((bottle) => bottle.match.map((m) => ({ pattern: normalizeBottle(m), category, bottle })))
);

export interface BottleMatch {
  category: ScCategory;
  bottle: ScBottle;
}

/** The book's category for a bottle name (e.g. "Smith & Cross Traditional Jamaica Rum"), or null if it isn't listed. */
export function findBottle(name: string | null | undefined): BottleMatch | null {
  if (!name) return null;
  const text = ` ${normalizeBottle(name)} `;
  if (NOT_CLASSIFIED.test(text)) return null;
  let best: (typeof PATTERNS)[number] | null = null;
  for (const p of PATTERNS) {
    if (text.includes(` ${p.pattern} `) && (!best || p.pattern.length > best.pattern.length)) best = p;
  }
  if (!best) return null;
  // A different product that only starts like a listed one.
  if (NOT_LISTED.some((n) => text.includes(` ${n} `) && n.length >= best!.pattern.length)) return null;
  // An overproof version of a regular-strength listing isn't that listing.
  const overproofName = /\b(151|overproof|over proof)\b/.test(text);
  if (overproofName && best.category.id !== "black-blended-overproof" && !/overproof/i.test(best.bottle.label)) return null;
  return { category: best.category, bottle: best.bottle };
}

export interface StyleCategory {
  category: ScCategory;
  basis: "book" | "closest";
  note: string;
}

/** The closest category for one of our catalog rum styles, or null (flavored rums, liqueurs…). */
export function styleCategory(ingredientId: string | null | undefined): StyleCategory | null {
  const m = ingredientId ? SC_STYLE_MAP[ingredientId] : undefined;
  const category = m ? BY_ID.get(m.category) : undefined;
  return m && category ? { category, basis: m.basis, note: m.note } : null;
}

/** For a bottle in our bar: the book's listing if the bottle is in it, else its style's closest category. */
export function bottleCategory(ingredientId: string, bottle: string | null | undefined): (StyleCategory & { listed: ScBottle | null }) | null {
  const found = findBottle(bottle);
  if (found) return { category: found.category, basis: "book", note: `Listed in the book: ${found.bottle.label}.`, listed: found.bottle };
  const style = styleCategory(ingredientId);
  return style ? { ...style, listed: null } : null;
}

/** "❸" for the numbered categories. */
export const SC_GLYPHS = ["", "❶", "❷", "❸", "❹", "❺", "❻", "❼", "❽"] as const;

/** Bottles in the book whose name or category matches a search (for "what's my bottle's number?"). */
export function searchBottles(query: string): BottleMatch[] {
  const q = normalizeBottle(query);
  if (!q) return [];
  const direct = findBottle(query);
  const words = q.split(" ");
  const hits = SC_CATEGORIES.flatMap((category) =>
    category.bottles
      .filter((bottle) => {
        const hay = normalizeBottle(`${bottle.label} ${bottle.region} ${category.name}`);
        return words.every((w) => ` ${hay} `.includes(` ${w}`));
      })
      .map((bottle) => ({ category, bottle }))
  );
  if (direct && !hits.some((h) => h.bottle === direct.bottle)) hits.unshift(direct);
  return hits;
}

/** Our catalog styles that are rums (or cachaça), i.e. can carry a number in our bar. */
export function isRumStyle(ingredientId: string, family: string | undefined): boolean {
  return family === "Rum" || ingredientId === "cachaca";
}

export type BarRumBasis = "saved" | "book" | "style";

/**
 * A bottle in our bar: the category we saved for it, else the book's
 * listing of the bottle, else its style's category. `approx` when that's
 * only our closest match.
 */
export function barRumCategory(
  ingredientId: string,
  bottle: string | null | undefined,
  saved: string | null | undefined,
  /** Where the saved label came from: the rum checker's guess ("ai") or our own pick ("ours"). */
  savedBasis: string | null = "ours"
): { category: ScCategory; basis: BarRumBasis; approx: boolean } | null {
  // The book's listing of the bottle wins over any label we saved.
  const found = findBottle(bottle);
  if (found) return { category: found.category, basis: "book", approx: false };
  const mine = saved ? getScCategory(saved) : undefined;
  if (mine) return { category: mine, basis: "saved", approx: savedBasis !== "ours" };
  const style = styleCategory(ingredientId);
  return style ? { category: style.category, basis: "style", approx: style.basis === "closest" } : null;
}
