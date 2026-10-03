import { mlPerUnit, parseAmount } from "./amounts";
import { getIngredient, resolveLine } from "./ingredients";

/**
 * Style tags, worked out from a drink's verified ingredients (never
 * guessed by an AI): one structure (how it's built), its base spirits, and
 * a few flavor words. The rules are deliberately simple and listed here so
 * they can be checked; tasters can fix any drink's tags on its card (the
 * fixes are stored as overrides, migration 0013).
 */

export type StyleGroup = "structure" | "base" | "flavor";

export interface StyleTag {
  id: string;
  label: string;
  group: StyleGroup;
  /** How the rule decides, shown to tasters. */
  rule: string;
}

export const STYLE_TAGS: StyleTag[] = [
  { id: "sparkling", label: "Sparkling", group: "structure", rule: "Topped with Champagne, prosecco or other sparkling wine." },
  { id: "creamy", label: "Creamy & rich", group: "structure", rule: "Has cream, cream of coconut, milk or egg yolk." },
  { id: "highball", label: "Highball", group: "structure", rule: "Lengthened with a fizzy mixer (at least 2 fl oz, or topped up)." },
  { id: "juice-led", label: "Juice-led", group: "structure", rule: "Mostly fruit or tomato juice: at least 2 fl oz and over twice the citrus, or (with no citrus) at least 1 fl oz and a third of the drink." },
  { id: "sour", label: "Sour", group: "structure", rule: "Balanced with fresh lime, lemon or grapefruit." },
  { id: "spirit-forward", label: "Spirit-forward", group: "structure", rule: "No citrus, juice, cream or mixer: spirits, liqueurs, vermouth, bitters." },
  { id: "aperitif", label: "Aperitif", group: "structure", rule: "No citrus, juice, cream or mixer, and no base spirit: wine, sherry, vermouth or aperitivo-led." },
  { id: "rum", label: "Rum & cane", group: "base", rule: "Rum, rhum agricole, cachaça or other cane spirit." },
  { id: "gin", label: "Gin", group: "base", rule: "Gin or genever." },
  { id: "whiskey", label: "Whiskey", group: "base", rule: "Bourbon, rye, Scotch, Irish and other whiskies." },
  { id: "brandy", label: "Brandy", group: "base", rule: "Cognac, apple brandy, pisco, grappa." },
  { id: "agave", label: "Agave", group: "base", rule: "Tequila or mezcal." },
  { id: "vodka", label: "Vodka", group: "base", rule: "Vodka." },
  { id: "liqueur-led", label: "Liqueur-led", group: "base", rule: "No base spirit, but a real pour of a strong liqueur or amaro (Chartreuse, Fernet, absinthe)." },
  { id: "low-abv", label: "Lower-alcohol", group: "base", rule: "No base spirit and no strong liqueur: wine, sherry, vermouth or aperitivo-led." },
  { id: "bitter", label: "Bitter", group: "flavor", rule: "Campari, Aperol, amaro, Cynar or Fernet (at least 5 ml), or a big pour of bitters." },
  { id: "smoky", label: "Smoky", group: "flavor", rule: "Mezcal or peated Islay Scotch." },
  { id: "herbal", label: "Herbal", group: "flavor", rule: "At least 5 ml of Chartreuse, Bénédictine, absinthe, Fernet, Galliano, Drambuie or crème de menthe (not a dash or rinse), or fresh mint or basil." },
  { id: "spiced", label: "Spiced", group: "flavor", rule: "Ginger, allspice, cinnamon, falernum (at least 5 ml), or fresh ginger, cloves, chili or Bloody Mary spice." },
  { id: "fruity", label: "Fruity", group: "flavor", rule: "At least 10 ml of non-citrus fruit in all (pineapple, passion fruit, orange juice, berries, stone fruit, banana, cranberry), or fresh fruit." },
  { id: "nutty", label: "Nutty", group: "flavor", rule: "Orgeat, amaretto or hazelnut liqueur." },
  { id: "coffee-chocolate", label: "Coffee & chocolate", group: "flavor", rule: "Coffee, coffee liqueur or crème de cacao." },
];

const BY_ID = new Map(STYLE_TAGS.map((t) => [t.id, t]));
export const getStyleTag = (id: string) => BY_ID.get(id);
export const STYLE_GROUPS: { group: StyleGroup; label: string }[] = [
  { group: "structure", label: "Build" },
  { group: "base", label: "Base" },
  { group: "flavor", label: "Flavor" },
];

const BASE_BY_FAMILY: Record<string, string> = {
  Rum: "rum",
  "Other cane spirits": "rum",
  "Gin & genever": "gin",
  Whiskey: "whiskey",
  Brandy: "brandy",
  Agave: "agave",
  Vodka: "vodka",
};
// Liqueurs that are really an ingredient style of their own, not a base spirit,
// even though they sit in a spirit family.
const NOT_A_BASE = new Set(["crema-de-mezcal", "malibu", "coconut-rum", "pineapple-rum", "new-make-spirit"]);
const HIGH_PROOF_MODIFIERS = new Set(["green-chartreuse", "yellow-chartreuse", "fernet", "absinthe", "absinthe-blanche"]);

const SPARKLING = new Set(["champagne", "prosecco"]);
const CREAMY = new Set(["cream", "cream-of-coconut", "milk", "egg-yolk"]);
const MIXERS = new Set(["soda-water", "ginger-beer", "ginger-ale", "cola", "grapefruit-soda"]);
const CITRUS = new Set(["lime", "lemon-juice", "grapefruit-juice", "lime-cordial"]);
const JUICES = new Set([
  "pineapple-juice",
  "orange-juice",
  "cranberry-juice",
  "tomato-juice",
  "passion-fruit-puree",
  "white-peach-puree",
  "coconut-water",
  "sugar-cane-juice",
]);
const BITTER = new Set(["italian-red-bitter", "red-aperitivo", "amaro", "amaro-montenegro", "amaro-nonino", "cynar", "fernet"]);
const SMOKY = new Set(["mezcal", "crema-de-mezcal", "islay-scotch"]);
const HERBAL = new Set([
  "green-chartreuse",
  "yellow-chartreuse",
  "benedictine",
  "absinthe",
  "absinthe-blanche",
  "galliano",
  "drambuie",
  "fernet",
  "white-creme-de-menthe",
  "green-creme-de-menthe",
  "mint",
  "basil",
]);
const SPICED = new Set([
  "ginger-beer",
  "ginger-syrup",
  "fresh-ginger",
  "chili-pepper",
  "cinnamon-syrup",
  "allspice-dram",
  "falernum",
  "pimento-bitters",
  "cloves",
  "bloody-mary-seasoning",
  "spiced-rum-cacao-coffee",
]);
const FRUITY = new Set([
  "pineapple-juice",
  "orange-juice",
  "cranberry-juice",
  "passion-fruit-puree",
  "passion-fruit-syrup",
  "passion-fruit-liqueur",
  "white-peach-puree",
  "banana-liqueur",
  "pineapple-liqueur",
  "pineapple-syrup",
  "pineapple-rum",
  "apricot-liqueur",
  "cherry-liqueur",
  "blackberry-liqueur",
  "peach-liqueur",
  "peach-schnapps",
  "creme-de-cassis",
  "raspberry-liqueur",
  "raspberry-syrup",
  "strawberries",
  "strawberry-syrup",
  "fresh-pineapple",
]);
/** Counted by the piece rather than measured, but still a real flavor. */
const FRESH = new Set([
  "mint",
  "basil",
  "fresh-ginger",
  "chili-pepper",
  "cloves",
  "bloody-mary-seasoning",
  "strawberries",
  "fresh-pineapple",
  "coffee",
]);
const NUTTY = new Set(["orgeat-syrup", "orgeat-almond-liqueur", "amaretto", "hazelnut-liqueur"]);
const COFFEE_CHOC = new Set([
  "coffee",
  "coffee-liqueur",
  "white-creme-de-cacao",
  "dark-creme-de-cacao",
  "chocolate-orange-liqueur",
  "spiced-rum-cacao-coffee",
]);

export interface StyleLine {
  amount: string;
  unit: string;
  ingredient: string;
  catalogId?: string | null;
}

/** ml for a measured line (midpoint of a range); null if it isn't a volume. */
function lineMl(l: StyleLine): number | null {
  const per = mlPerUnit(l.unit);
  if (per === null) return null;
  const a = parseAmount(l.amount);
  if (a.kind === "number") return a.value * per;
  if (a.kind === "range") return ((a.low + a.high) / 2) * per;
  return null;
}

/** A top-up/fill with no measure ("Soda water (top up)", amount ""). */
const isTopUp = (l: StyleLine) => /\b(top|fill)\b/i.test(l.ingredient) || (l.amount.trim() === "" && l.unit.trim() === "");

/**
 * The computed tags for a drink, in STYLE_TAGS order: exactly one
 * structure, its base spirits (or lower-alcohol), and any flavors.
 */
export function computeStyles(lines: StyleLine[]): string[] {
  const resolved = lines
    .map((l) => ({ l, id: resolveLine(l.ingredient, l.catalogId)?.ingredient.id ?? null, ml: lineMl(l) }))
    .filter((x): x is { l: StyleLine; id: string; ml: number | null } => x.id !== null);
  const has = (set: Set<string>) => resolved.some((x) => set.has(x.id));
  const tags = new Set<string>();

  // A pour that registers in the glass: at least 5 ml measured, or a fresh
  // ingredient counted by the piece (mint leaves, ginger slices, espresso).
  // Dashes, drops, barspoons and rinses are accents, not a flavor.
  const tastes = (x: { id: string; ml: number | null }) => (x.ml ?? 0) >= 5 || (x.ml === null && FRESH.has(x.id));
  const hasTaste = (set: Set<string>) => resolved.some((x) => set.has(x.id) && tastes(x));
  const garnishLike = (x: { l: StyleLine }) => /wheel|zest|peel|twist|slice/i.test(x.l.ingredient) && !/chili|ginger/i.test(x.l.ingredient);

  // Structure (first rule that matches).
  // (Anything served on the side isn't in the drink.)
  const totalMl = resolved.filter((x) => !/\bside\b/i.test(x.l.ingredient)).reduce((n, x) => n + (x.ml ?? 0), 0);
  const citrusMl = resolved
    .filter((x) => CITRUS.has(x.id) && !garnishLike(x))
    .reduce((n, x) => n + (x.ml ?? (parseAmount(x.l.amount).kind !== "text" ? 15 : 0)), 0);
  const juiceMl = resolved.filter((x) => JUICES.has(x.id)).reduce((n, x) => n + (x.ml ?? 0), 0);
  const mixers = resolved.filter((x) => MIXERS.has(x.id));
  const mixer =
    mixers.reduce((n, x) => n + (x.ml ?? 0), 0) >= 60 || mixers.some((x) => x.ml === null && isTopUp(x.l));
  if (resolved.some((x) => SPARKLING.has(x.id) && !/\bside\b/i.test(x.l.ingredient))) tags.add("sparkling");
  else if (has(CREAMY)) tags.add("creamy");
  else if (mixer) tags.add("highball");
  else if (juiceMl >= 60 && juiceMl > 2 * citrusMl) tags.add("juice-led");
  else if (citrusMl >= 7.5) tags.add("sour");
  else if (juiceMl >= 30 && juiceMl >= 0.3 * totalMl) tags.add("juice-led");

  // Base spirits (a real pour: at least 1/4 fl oz, or unmeasured).
  let base = false;
  for (const x of resolved) {
    if (NOT_A_BASE.has(x.id) || (x.ml !== null && x.ml < 7.5)) continue;
    const b = BASE_BY_FAMILY[getIngredient(x.id)!.family];
    if (b) {
      tags.add(b);
      base = true;
    }
  }
  const strongModifier = resolved.some((x) => HIGH_PROOF_MODIFIERS.has(x.id) && (x.ml ?? 0) >= 15);
  if (!base) tags.add(strongModifier ? "liqueur-led" : "low-abv");
  if (![...tags].some((t) => BY_ID.get(t)?.group === "structure")) tags.add(!base && !strongModifier ? "aperitif" : "spirit-forward");

  // Flavors.
  const bigBitters = resolved.some((x) => x.id === "angostura-bitters" && (x.ml ?? 0) >= 15);
  if (hasTaste(BITTER) || bigBitters) tags.add("bitter");
  if (hasTaste(SMOKY)) tags.add("smoky");
  if (hasTaste(HERBAL)) tags.add("herbal");
  if (hasTaste(SPICED)) tags.add("spiced");
  const fruit = resolved.filter((x) => FRUITY.has(x.id) && !garnishLike(x));
  if (fruit.reduce((n, x) => n + (x.ml ?? 0), 0) >= 10 || fruit.some((x) => x.ml === null && FRESH.has(x.id))) tags.add("fruity");
  if (hasTaste(NUTTY)) tags.add("nutty");
  if (hasTaste(COFFEE_CHOC)) tags.add("coffee-chocolate");

  return STYLE_TAGS.filter((t) => tags.has(t.id)).map((t) => t.id);
}

export interface StyleOverride {
  tag: string;
  include: boolean;
}

/** Computed tags with a taster's fixes applied (unknown tags ignored), in STYLE_TAGS order. */
export function applyStyleOverrides(computed: string[], overrides: StyleOverride[]): string[] {
  const tags = new Set(computed);
  for (const o of overrides) {
    if (!BY_ID.has(o.tag)) continue;
    if (o.include) tags.add(o.tag);
    else tags.delete(o.tag);
  }
  return STYLE_TAGS.filter((t) => tags.has(t.id)).map((t) => t.id);
}

/** The overrides that turn the computed tags into the chosen ones. */
export function overridesFor(computed: string[], chosen: string[]): StyleOverride[] {
  const c = new Set(computed);
  const want = new Set(chosen.filter((t) => BY_ID.has(t)));
  return STYLE_TAGS.flatMap((t): StyleOverride[] =>
    want.has(t.id) && !c.has(t.id) ? [{ tag: t.id, include: true }] : !want.has(t.id) && c.has(t.id) ? [{ tag: t.id, include: false }] : []
  );
}

/** Reads ?style= (comma-separated tag ids, possibly repeated): known ids only, in STYLE_TAGS order. */
export function parseStyleFilter(value: string | string[] | undefined): string[] {
  const parts = [value]
    .flat()
    .filter((v): v is string => typeof v === "string")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter((v) => BY_ID.has(v));
  const chosen = new Set(parts);
  // One URL per view: tags always in STYLE_TAGS order.
  return STYLE_TAGS.filter((t) => chosen.has(t.id)).map((t) => t.id);
}

/** Does a drink have every selected style tag? */
export function matchesStyles(tags: string[] | undefined, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const have = new Set(tags ?? []);
  return selected.every((t) => have.has(t));
}
