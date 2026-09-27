import "server-only";
import { cache } from "react";
import { getSignedInUser } from "./auth/current-taster";
import { getIngredient } from "./ingredients";
import type { BottleLevel, RecordedPourLine } from "./inventory";
import { createSupabaseServerClient } from "./supabase-server";

/** ingredient id -> exact bottle owned (or null if not specified). */
export type Cabinet = Map<string, string | null>;
/** ingredient id -> bottle size and how much is left (for tracked bottles). */
export type Inventory = Map<string, BottleLevel>;

/**
 * The shared bar cabinet and bottle levels, read as the signed-in taster
 * (RLS: tasters only). Null when nobody (or a non-taster) is signed in. Ids
 * the catalog doesn't know are ignored. Cached per request.
 */
export const fetchBar = cache(async (): Promise<{ cabinet: Cabinet; inventory: Inventory } | null> => {
  const user = await getSignedInUser();
  if (!user?.taster) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("cabinet_items").select("ingredient_id, bottle, size_ml, remaining_ml");
  if (error) throw new Error(`Failed to fetch cabinet: ${error.message}`);
  const cabinet: Cabinet = new Map();
  const inventory: Inventory = new Map();
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  for (const row of (data ?? []) as {
    ingredient_id: string;
    bottle: string | null;
    size_ml: number | string | null;
    remaining_ml: number | string | null;
  }[]) {
    if (!getIngredient(row.ingredient_id)) continue;
    cabinet.set(row.ingredient_id, row.bottle);
    // numeric columns: accept numbers or numeric strings
    inventory.set(row.ingredient_id, { sizeMl: num(row.size_ml), remainingMl: num(row.remaining_ml) });
  }
  return { cabinet, inventory };
});

/** Just the cabinet (see fetchBar). */
export const fetchCabinet = cache(async (): Promise<Cabinet | null> => (await fetchBar())?.cabinet ?? null);

export interface PourRecord {
  id: string;
  servings: number;
  lines: RecordedPourLine[];
}

/** One recorded pour of this drink (for the "we made this" confirmation), or null. */
export async function fetchPour(id: string, cocktailId: string): Promise<PourRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const user = await getSignedInUser();
  if (!user?.taster) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("pours")
    .select("id, servings, lines")
    .eq("id", id)
    .eq("cocktail_id", cocktailId)
    .maybeSingle();
  if (error || !data) return null;
  const n = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN);
  const lines = Array.isArray(data.lines)
    ? (data.lines as { ingredient_id?: unknown; ml?: unknown; taken_ml?: unknown }[])
        .filter((l) => typeof l.ingredient_id === "string" && Number.isFinite(n(l.ml)))
        .map((l) => ({
          ingredientId: l.ingredient_id as string,
          ml: n(l.ml),
          takenMl: Number.isFinite(n(l.taken_ml)) ? n(l.taken_ml) : 0,
        }))
    : [];
  return { id: data.id as string, servings: Number(data.servings), lines };
}

/**
 * The shared shopping list (ingredient ids), read as the signed-in taster
 * (RLS: tasters only). Null when nobody (or a non-taster) is signed in.
 * Unknown ids are ignored. Cached per request.
 */
export const fetchShoppingList = cache(async (): Promise<Set<string> | null> => {
  const user = await getSignedInUser();
  if (!user?.taster) return null;
  const db = await createSupabaseServerClient();
  const { data, error } = await db.from("shopping_items").select("ingredient_id");
  if (error) throw new Error(`Failed to fetch shopping list: ${error.message}`);
  return new Set(
    ((data ?? []) as { ingredient_id: string }[]).map((r) => r.ingredient_id).filter((id) => getIngredient(id))
  );
});
