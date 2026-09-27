import "server-only";
import { cache } from "react";
import { getSignedInUser } from "./auth/current-taster";
import { getIngredient } from "./ingredients";
import { createSupabaseServerClient } from "./supabase-server";

/** ingredient id -> exact bottle owned (or null if not specified). */
export type Cabinet = Map<string, string | null>;

/**
 * The shared bar cabinet, read as the signed-in taster (RLS: tasters only).
 * Returns null when nobody (or a non-taster) is signed in. Ids the catalog
 * doesn't know are ignored. Cached per request.
 */
export const fetchCabinet = cache(async (): Promise<Cabinet | null> => {
  const user = await getSignedInUser();
  if (!user?.taster) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("cabinet_items").select("ingredient_id, bottle");
  if (error) throw new Error(`Failed to fetch cabinet: ${error.message}`);
  const cabinet: Cabinet = new Map();
  for (const row of (data ?? []) as { ingredient_id: string; bottle: string | null }[]) {
    if (getIngredient(row.ingredient_id)) cabinet.set(row.ingredient_id, row.bottle);
  }
  return cabinet;
});
