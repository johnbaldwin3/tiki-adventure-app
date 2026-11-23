import { cache } from "react";
import { supabase } from "./supabase";
import { mapVersions, VERSION_COLUMNS, type DrinkVersions, type RawVersionRow } from "./versions";

/** Current trial/active versions of every drink (public reads). Cached per request. */
export const fetchVersions = cache(async () => {
  const { data, error } = await supabase.from("cocktail_versions").select(VERSION_COLUMNS).in("status", ["trial", "active"]);
  if (error) throw new Error(`Failed to fetch versions: ${error.message}`);
  return mapVersions((data ?? []) as RawVersionRow[]);
});

/** One drink's current trial/active versions ({} if none). */
export async function fetchCocktailVersions(cocktailId: string): Promise<DrinkVersions> {
  return (await fetchVersions()).get(cocktailId) ?? {};
}
