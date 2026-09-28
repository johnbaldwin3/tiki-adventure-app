"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import {
  collectionSlug,
  mapCollections,
  planMembershipChange,
  readCollectionForm,
  readCollectionPicks,
  readShownCollections,
  validateCollectionName,
  type RawCollectionRow,
} from "@/lib/collections";
import { withParam } from "@/lib/shopping";
import { SLUG_PATTERN } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Collection actions, used by plain <form>s (they work without JavaScript).
 * Server Actions can be POSTed to directly, so everything is re-checked
 * here, and writes run as the signed-in taster so the RLS policies and
 * column grants from migration 0011 apply too.
 */

async function requireTaster(returnTo: string) {
  const user = await getSignedInUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!user.taster) redirect(withParam(returnTo, "collections", "error"));
  return user.taster;
}

async function loadCollections(db: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await db.from("collections").select("id, slug, name, description, sort_order, built_in");
  if (error) throw new Error(`Failed to load collections: ${error.message}`);
  return mapCollections((data ?? []) as RawCollectionRow[]);
}

/** Back to /collections with which form had which problem (the new name is kept to fix). */
function invalid(problem: string, which: string, name?: string): never {
  let to = withParam(withParam(withParam("/collections", "collections", "invalid"), "reason", problem), "for", which);
  if (name) to = withParam(to, "name", name);
  redirect(to);
}

function revalidateLists() {
  revalidatePath("/");
  revalidatePath("/collections");
}

/** Sets which collections one drink is in (the checkboxes on its card). */
export async function setDrinkCollections(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  const returnTo = `/cocktails/${slug}`;
  await requireTaster(returnTo);
  const db = await createSupabaseServerClient();
  let status = "saved";
  try {
    const { data: drink, error: drinkError } = await db.from("cocktails").select("id").eq("slug", slug).maybeSingle();
    if (drinkError) throw drinkError;
    if (!drink) redirect("/");
    const collections = await loadCollections(db);
    const picked = readCollectionPicks(formData, collections);
    const { data: rows, error: memError } = await db
      .from("cocktail_collections")
      .select("collection_id")
      .eq("cocktail_id", drink.id);
    if (memError) throw memError;
    const current = ((rows ?? []) as { collection_id: string }[]).map((r) => r.collection_id);
    const { add, remove } = planMembershipChange(current, picked, readShownCollections(formData));
    if (add.length > 0) {
      const { error } = await db
        .from("cocktail_collections")
        .upsert(
          add.map((id) => ({ cocktail_id: drink.id, collection_id: id })),
          { onConflict: "collection_id,cocktail_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    }
    if (remove.length > 0) {
      const { error } = await db
        .from("cocktail_collections")
        .delete()
        .eq("cocktail_id", drink.id)
        .in("collection_id", remove);
      if (error) throw error;
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("setDrinkCollections failed", err);
    status = "error";
  }
  revalidateLists();
  revalidatePath(returnTo);
  redirect(`${withParam(returnTo, "collections", status)}#collections`);
}

/** Adds a collection (from /collections). */
export async function createCollection(formData: FormData): Promise<void> {
  await requireTaster("/collections");
  const draft = readCollectionForm(formData);
  const db = await createSupabaseServerClient();
  let status = "added";
  try {
    const collections = await loadCollections(db);
    const problem = validateCollectionName(draft.name, collections);
    if (problem) invalid(problem, "new", draft.name);
    const { error } = await db
      .from("collections")
      .insert({ slug: collectionSlug(draft.name), name: draft.name, description: draft.description || null });
    if (error) throw error;
  } catch (err) {
    unstable_rethrow(err);
    console.error("createCollection failed", err);
    status = "error";
  }
  revalidateLists();
  redirect(withParam("/collections", "collections", status));
}

/** Renames a collection / changes its description. */
export async function updateCollection(formData: FormData): Promise<void> {
  await requireTaster("/collections");
  const id = String(formData.get("id") ?? "");
  const draft = readCollectionForm(formData);
  const db = await createSupabaseServerClient();
  let status = "saved";
  try {
    const collections = await loadCollections(db);
    const me = collections.find((c) => c.id === id);
    if (!me) redirect(withParam("/collections", "collections", "error"));
    const problem = validateCollectionName(draft.name, collections.filter((c) => c.id !== id));
    if (problem) invalid(problem, id);
    // The slug (the collection's URL) stays put, so old links keep working.
    const { error } = await db
      .from("collections")
      .update({ name: draft.name, description: draft.description || null })
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    unstable_rethrow(err);
    console.error("updateCollection failed", err);
    status = "error";
  }
  revalidateLists();
  redirect(withParam("/collections", "collections", status));
}

/** Removes a collection we added (the drinks stay; built-in ones can't be removed). */
export async function deleteCollection(formData: FormData): Promise<void> {
  await requireTaster("/collections");
  const id = String(formData.get("id") ?? "");
  if (formData.get("confirm") !== "on") redirect(withParam("/collections", "collections", "confirm"));
  const db = await createSupabaseServerClient();
  let status = "deleted";
  try {
    const collections = await loadCollections(db);
    const me = collections.find((c) => c.id === id);
    if (!me || me.builtIn) redirect(withParam("/collections", "collections", "error"));
    const { error } = await db.from("collections").delete().eq("id", id);
    if (error) throw error;
  } catch (err) {
    unstable_rethrow(err);
    console.error("deleteCollection failed", err);
    status = "error";
  }
  revalidateLists();
  redirect(withParam("/collections", "collections", status));
}
