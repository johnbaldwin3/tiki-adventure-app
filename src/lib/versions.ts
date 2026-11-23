import { parseIngredients, type Ingredient } from "./cocktails";

/** A tried or kept tweak of a drink (migration 0014). */
export interface CocktailVersion {
  id: string;
  cocktailId: string;
  status: "trial" | "active";
  ingredients: Ingredient[];
  methodSummary: string | null;
  critique: string | null;
  reasoning: string | null;
  createdBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface RawVersionRow {
  id: string;
  cocktail_id: string;
  status: string;
  ingredients: unknown;
  method_summary: string | null;
  critique: string | null;
  reasoning: string | null;
  created_by: string | null;
  created_at: string;
  decided_at: string | null;
}

export type DrinkVersions = { trial?: CocktailVersion; active?: CocktailVersion };

/** cocktail id -> its current trial and/or active version (retired ones are history, not loaded). */
export function mapVersions(rows: RawVersionRow[]): Map<string, DrinkVersions> {
  const out = new Map<string, DrinkVersions>();
  for (const r of rows) {
    if (r.status !== "trial" && r.status !== "active") continue;
    const ingredients = parseIngredients(r.ingredients);
    if (ingredients.length === 0) continue;
    const v: CocktailVersion = {
      id: r.id,
      cocktailId: r.cocktail_id,
      status: r.status,
      ingredients,
      methodSummary: r.method_summary ?? null,
      critique: r.critique ?? null,
      reasoning: r.reasoning ?? null,
      createdBy: r.created_by ?? null,
      createdAt: r.created_at,
      decidedAt: r.decided_at ?? null,
    };
    const entry = out.get(r.cocktail_id) ?? {};
    entry[r.status] = v;
    out.set(r.cocktail_id, entry);
  }
  return out;
}

export const VERSION_COLUMNS = "id, cocktail_id, status, ingredients, method_summary, critique, reasoning, created_by, created_at, decided_at";
