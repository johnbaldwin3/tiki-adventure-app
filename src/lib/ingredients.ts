import { FAMILIES, INGREDIENT_ALIASES, INGREDIENTS, type Family, type Ingredient } from "@/data/ingredients";

export type { Family, Ingredient };

const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

export function getIngredient(id: string): Ingredient | undefined {
  return BY_ID.get(id);
}

export interface ResolvedIngredient {
  ingredient: Ingredient;
  /** The recipe marks this line "(optional)". */
  optional: boolean;
}

/**
 * Maps a recipe's ingredient wording (exactly as stored) to its catalog
 * entry. Returns null for wording the catalog doesn't know yet, so callers
 * can fall back to showing the plain text.
 */
export function resolveIngredient(text: string): ResolvedIngredient | null {
  const id = INGREDIENT_ALIASES[text.trim()];
  const ingredient = id ? BY_ID.get(id) : undefined;
  if (!ingredient) return null;
  return { ingredient, optional: /\(optional\)/i.test(text) };
}

/** Catalog grouped by family, in FAMILIES order, each family sorted by name. */
export function ingredientsByFamily(list: Ingredient[] = INGREDIENTS): { family: Family; items: Ingredient[] }[] {
  return FAMILIES.map((family) => ({
    family,
    items: list.filter((i) => i.family === family).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

export interface CocktailIngredientLines {
  slug: string;
  ingredientTexts: string[];
}

/**
 * For each catalog id, the slugs of cocktails that use it (a cocktail is
 * listed once even if it uses the ingredient on several lines).
 */
export function cocktailsByIngredient(cocktails: CocktailIngredientLines[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const c of cocktails) {
    const ids = new Set(
      c.ingredientTexts.map((t) => resolveIngredient(t)?.ingredient.id).filter((id): id is string => !!id)
    );
    for (const id of ids) index.set(id, [...(index.get(id) ?? []), c.slug]);
  }
  return index;
}

/** Every original wording that maps to this catalog id (for "written in recipes as"). */
export function aliasesFor(id: string): string[] {
  return Object.entries(INGREDIENT_ALIASES)
    .filter(([, v]) => v === id)
    .map(([k]) => k)
    .sort((a, b) => a.localeCompare(b));
}
