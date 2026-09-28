import { getIngredient } from "./ingredients";
import { slugify, SLUG_PATTERN } from "./slug";

/**
 * Pure model + validation for adding/editing one of our own recipes (the
 * review form after an AI import, and the edit form). No Next/Supabase
 * imports, so it's unit-testable and shared by the Server Actions and the
 * form. Limits mirror migration 0008's checks.
 */

export const LIMITS = {
  name: 80,
  spirits: 6,
  spirit: 40,
  glass: 200,
  garnish: 300,
  method: 2000,
  ingredients: 30,
  amount: 20,
  unit: 20,
  ingredient: 120,
  sourceUrl: 500,
  sourceNote: 200,
} as const;

export interface RecipeLine {
  amount: string;
  unit: string;
  ingredient: string;
  /** Catalog style id, or "" when it isn't in our catalog. */
  catalogId: string;
}

export interface RecipeDraft {
  name: string;
  /** Comma-separated in the form, e.g. "Jamaican rum, Demerara rum". */
  primarySpirits: string;
  glass: string;
  garnish: string;
  method: string;
  ingredients: RecipeLine[];
  sourceUrl: string;
  sourceNote: string;
  /** A best guess (e.g. worked out from a menu description), not a tested recipe. */
  isGuess: boolean;
  /** Collection ids it's in (checked against the real list on save). */
  collections: string[];
}

export const EMPTY_LINE: RecipeLine = { amount: "", unit: "", ingredient: "", catalogId: "" };

export function emptyDraft(): RecipeDraft {
  return {
    name: "",
    primarySpirits: "",
    glass: "",
    garnish: "",
    method: "",
    ingredients: [],
    sourceUrl: "",
    sourceNote: "",
    isGuess: false,
    collections: [],
  };
}

export type RecipeErrors = Partial<Record<"name" | "ingredients" | "sourceUrl" | "form", string>> & {
  lines?: Record<number, string>;
};

type FormLike = { get(name: string): unknown; getAll?(name: string): unknown[] };

const clean = (v: unknown, max: number) =>
  typeof v === "string" ? Array.from(v.replace(/\s+/g, " ").trim()).slice(0, max).join("").trim() : "";

/** Multi-line text (method): keeps line breaks, trims each, caps length. */
const cleanBlock = (v: unknown, max: number) =>
  typeof v === "string"
    ? Array.from(
        v
          .replace(/\r\n?/g, "\n")
          .split("\n")
          .map((l) => l.replace(/[ \t]+/g, " ").trim())
          .join("\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      )
        .slice(0, max)
        .join("")
        .trim()
    : "";

/** Only catalog ids the app knows and that aren't staples-only noise; anything else -> "". */
export function cleanCatalogId(v: unknown): string {
  return typeof v === "string" && getIngredient(v) ? v : "";
}

/**
 * Reads the form (ingredient rows are line-0-amount, line-0-unit,
 * line-0-ingredient, line-0-catalog, … up to `lines`). Blank rows are
 * dropped. Everything is trimmed and capped, never trusted.
 */
export function readRecipeForm(form: FormLike): RecipeDraft {
  const count = Math.min(Number(form.get("lines")) || 0, LIMITS.ingredients + 10);
  const ingredients: RecipeLine[] = [];
  for (let i = 0; i < count; i++) {
    const line = {
      amount: clean(form.get(`line-${i}-amount`), LIMITS.amount),
      unit: clean(form.get(`line-${i}-unit`), LIMITS.unit),
      ingredient: clean(form.get(`line-${i}-ingredient`), LIMITS.ingredient),
      catalogId: cleanCatalogId(form.get(`line-${i}-catalog`)),
    };
    if (line.amount || line.unit || line.ingredient) ingredients.push(line);
  }
  return {
    name: clean(form.get("name"), LIMITS.name),
    primarySpirits: clean(form.get("primarySpirits"), LIMITS.spirits * (LIMITS.spirit + 2)),
    glass: clean(form.get("glass"), LIMITS.glass),
    garnish: clean(form.get("garnish"), LIMITS.garnish),
    method: cleanBlock(form.get("method"), LIMITS.method),
    ingredients,
    sourceUrl: clean(form.get("sourceUrl"), LIMITS.sourceUrl),
    sourceNote: clean(form.get("sourceNote"), LIMITS.sourceNote),
    isGuess: form.get("isGuess") === "on",
    collections: [
      ...new Set(
        (form.getAll?.("collection") ?? [])
          .filter((v): v is string => typeof v === "string" && /^[0-9a-z-]{1,64}$/i.test(v))
          .slice(0, 50)
      ),
    ],
  };
}

export function parseSpirits(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((s) => clean(s, LIMITS.spirit))
        .filter(Boolean)
    ),
  ].slice(0, LIMITS.spirits);
}

/** http(s) URL or null; anything else (javascript:, relative, junk) -> null. */
export function safeHttpUrl(value: string): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    const out = u.toString();
    return out.length <= LIMITS.sourceUrl ? out : null;
  } catch {
    return null;
  }
}

export function validateRecipe(d: RecipeDraft): RecipeErrors {
  const errors: RecipeErrors = {};
  if (!d.name) errors.name = "Give the drink a name.";
  else if (!SLUG_PATTERN.test(slugify(d.name))) errors.name = "Use at least one letter or number in the name.";
  if (d.ingredients.length === 0) errors.ingredients = "Add at least one ingredient.";
  else if (d.ingredients.length > LIMITS.ingredients) errors.ingredients = `At most ${LIMITS.ingredients} ingredients.`;
  const lines: Record<number, string> = {};
  d.ingredients.forEach((l, i) => {
    if (!l.ingredient) lines[i] = "Say what the ingredient is.";
  });
  if (Object.keys(lines).length > 0) errors.lines = lines;
  if (d.sourceUrl && !safeHttpUrl(d.sourceUrl)) errors.sourceUrl = "Use a full web address starting with https://.";
  return errors;
}

export const hasErrors = (e: RecipeErrors) => Object.keys(e).length > 0;

/** Row shape for the cocktails table (source = 'ours'). */
export function toCocktailRow(d: RecipeDraft) {
  return {
    name: d.name,
    primary_spirits: parseSpirits(d.primarySpirits),
    glass: d.glass || null,
    garnish: d.garnish || null,
    method_summary: d.method || null,
    ingredients: d.ingredients.map((l) => ({
      amount: l.amount,
      unit: l.unit,
      ingredient: l.ingredient,
      ...(l.catalogId ? { catalog_id: l.catalogId } : {}),
    })),
    source_url: safeHttpUrl(d.sourceUrl),
    source_note: d.sourceNote || null,
    is_guess: d.isGuess,
  };
}

/** A slug for a new recipe that doesn't clash with any existing one ("zombie" -> "zombie-2"). */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name).slice(0, 70).replace(/-+$/g, "") || "recipe";
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
