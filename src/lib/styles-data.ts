import { cache } from "react";
import type { StyleOverride } from "./styles";
import { supabase } from "./supabase";

/** Every taster fix to the computed style tags, by cocktail id (public reads). Cached per request. */
export const fetchStyleOverrides = cache(async (): Promise<Map<string, StyleOverride[]>> => {
  const { data, error } = await supabase.from("cocktail_style_overrides").select("cocktail_id, tag, include");
  if (error) throw new Error(`Failed to fetch style fixes: ${error.message}`);
  const out = new Map<string, StyleOverride[]>();
  for (const r of (data ?? []) as { cocktail_id: string; tag: string; include: boolean }[]) {
    const list = out.get(r.cocktail_id) ?? [];
    list.push({ tag: r.tag, include: r.include === true });
    out.set(r.cocktail_id, list);
  }
  return out;
});
