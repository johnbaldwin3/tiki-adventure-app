import { cache } from "react";
import {
  mapCollections,
  mapMemberships,
  type Collection,
  type Membership,
  type RawCollectionRow,
  type RawMembershipRow,
} from "./collections";
import { supabase } from "./supabase";

/**
 * All collections and who's in them (public reads, like the cocktail list).
 * Cached per request, since the list, card and suggestion pages all use it.
 */
export const fetchCollections = cache(async (): Promise<{ collections: Collection[]; memberships: Membership[] }> => {
  const [{ data: cols, error: colError }, { data: mems, error: memError }] = await Promise.all([
    supabase.from("collections").select("id, slug, name, description, sort_order, built_in"),
    supabase.from("cocktail_collections").select("cocktail_id, collection_id, note, note_url"),
  ]);
  if (colError) throw new Error(`Failed to fetch collections: ${colError.message}`);
  if (memError) throw new Error(`Failed to fetch collection members: ${memError.message}`);
  return {
    collections: mapCollections((cols ?? []) as RawCollectionRow[]),
    memberships: mapMemberships((mems ?? []) as RawMembershipRow[]),
  };
});

export interface CocktailCollection extends Collection {
  note: string | null;
  noteUrl: string | null;
}

/** The collections one drink is in, with each membership's note. */
export async function fetchCocktailCollections(
  cocktailId: string
): Promise<{ all: Collection[]; mine: CocktailCollection[] }> {
  const { collections, memberships } = await fetchCollections();
  const mine = memberships.filter((m) => m.cocktailId === cocktailId);
  return {
    all: collections,
    mine: collections.flatMap((c) => {
      const m = mine.find((x) => x.collectionId === c.id);
      return m ? [{ ...c, note: m.note, noteUrl: m.noteUrl }] : [];
    }),
  };
}
