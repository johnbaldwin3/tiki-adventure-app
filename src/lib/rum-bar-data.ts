import "server-only";
import { cache } from "react";
import { getIngredient } from "./ingredients";
import { isRumStyle } from "./rum-numbers";
import { createSupabaseServerClient } from "./supabase-server";
import { getSignedInUser } from "./auth/current-taster";

export interface BarRum {
  ingredientId: string;
  styleName: string;
  bottle: string | null;
  rumCategory: string | null;
  rumCategoryBasis: string | null;
}

/** The rums in our bar (tasters only, else null). */
export const fetchBarRums = cache(async (): Promise<BarRum[] | null> => {
  const user = await getSignedInUser();
  if (!user?.taster) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("cabinet_items").select("ingredient_id, bottle, rum_category, rum_category_basis");
  if (error) throw new Error(`Failed to fetch our rums: ${error.message}`);
  return ((data ?? []) as { ingredient_id: string; bottle: string | null; rum_category?: string | null; rum_category_basis?: string | null }[])
    .map((r) => ({ r, ing: getIngredient(r.ingredient_id) }))
    .filter(({ r, ing }) => ing && isRumStyle(r.ingredient_id, ing.family))
    .map(({ r, ing }) => ({ ingredientId: r.ingredient_id, styleName: ing!.name, bottle: r.bottle, rumCategory: r.rum_category ?? null, rumCategoryBasis: r.rum_category_basis ?? null }))
    .sort((a, b) => a.styleName.localeCompare(b.styleName));
});
