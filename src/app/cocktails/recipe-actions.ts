"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { hasErrors, readRecipeForm, toCocktailRow, uniqueSlug, validateRecipe, type RecipeDraft, type RecipeErrors } from "@/lib/recipe-form";
import { parseIngredients } from "@/lib/cocktails";
import { planMembershipChange, readShownCollections } from "@/lib/collections";
import type { GuessInfo, ImportKind } from "@/lib/recipe-import";
import { guessFromMenu, importRecipe, ImportError } from "@/lib/server/recipe-ai";
import { supabase } from "@/lib/supabase";
import { SLUG_PATTERN } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Server Actions for our own recipes: AI import (returns a draft to review
 * -- nothing is saved), save (new or edit), and delete. Server Actions can
 * be POSTed to directly, so every input is re-checked here, and writes run
 * as the signed-in taster so the cocktails RLS policies (migration 0008)
 * apply: tasters may only add/edit/delete source='ours' rows.
 */

/** Slugs that are routes, not recipes. */
const RESERVED_SLUGS = new Set(["new", "edit"]);
const MAX_TEXT = 20_000;
const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB of base64

export interface ImportState {
  submission: number;
  status: "idle" | "draft" | "none" | "error";
  message: string | null;
  draft: RecipeDraft | null;
  warnings: string[];
  kind: ImportKind;
  /** For a best guess from a menu: how it was worked out. */
  guess?: GuessInfo | null;
}

/** Our tested recipes (not other guesses), as ratio references for a menu guess: "1 1/2 fl oz Navy rum…". */
async function recipeLibrary(): Promise<{ name: string; slug: string; lines: string[] }[]> {
  const { data, error } = await supabase.from("cocktails").select("name, slug, ingredients, is_guess").order("name");
  if (error) throw new Error(`Failed to load recipes: ${error.message}`);
  return ((data ?? []) as { name: string; slug: string; ingredients: unknown; is_guess?: boolean | null }[])
    .filter((r) => r.is_guess !== true)
    .map((r) => ({
      name: r.name,
      slug: r.slug,
      lines: parseIngredients(r.ingredients).map((l) => [l.amount, l.unit, l.ingredient].filter(Boolean).join(" ")),
    }));
}

async function requireTaster() {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Fcocktails%2Fnew");
  if (!user.taster) return null;
  return user.taster;
}

export async function extractRecipe(prev: ImportState, formData: FormData): Promise<ImportState> {
  const submission = (prev?.submission ?? 0) + 1;
  const k = formData.get("kind");
  const kind: ImportKind = k === "photo" || k === "link" || k === "menu" ? k : "text";
  const fail = (message: string): ImportState => ({ submission, status: "error", message, draft: null, warnings: [], kind });

  if (!(await requireTaster())) return fail("Only JB & GM can add recipes.");

  const text = String(formData.get("text") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const image = String(formData.get("image") ?? "");
  if (kind === "text" && !text) return fail("Paste a recipe first.");
  if (kind === "text" && text.length > MAX_TEXT) return fail("That's too long — paste just the one recipe.");
  if (kind === "link" && !/^https?:\/\//i.test(url)) return fail("Paste a full link starting with https://.");
  if (kind === "photo" && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return fail("Choose a photo first.");
  }
  if (kind === "photo" && image.length > MAX_IMAGE_CHARS) return fail("That photo is too large. Try a smaller one.");

  if (kind === "menu") {
    const menu = String(formData.get("menu") ?? "").trim().slice(0, 2000);
    const name = String(formData.get("menuName") ?? "").trim().slice(0, 80);
    const place = String(formData.get("place") ?? "").trim().slice(0, 120);
    const menuImage = String(formData.get("menuImage") ?? "");
    const hasImage = menuImage !== "";
    if (!menu && !hasImage) return fail("Type what the menu says, or add a photo of it.");
    if (hasImage && (menuImage.length > MAX_IMAGE_CHARS || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(menuImage))) {
      return fail("That photo couldn't be used. Try a smaller JPEG or PNG.");
    }
    try {
      const result = await guessFromMenu({
        menu,
        name,
        place,
        imageDataUrl: hasImage ? menuImage : undefined,
        webSearch: formData.get("web") === "on",
        library: await recipeLibrary(),
      });
      if (!result) {
        return { submission, status: "none", message: "Couldn't make out a drink there.", draft: null, warnings: [], kind };
      }
      return { submission, status: "draft", message: null, draft: result.draft, warnings: result.warnings, kind, guess: result.guess ?? null };
    } catch (err) {
      console.error("extractRecipe (menu) failed", err);
      return fail(err instanceof ImportError ? err.userMessage : "Something went wrong. Please try again.");
    }
  }

  try {
    const result = await importRecipe(kind, { text, url, imageDataUrl: image });
    if (!result) {
      return { submission, status: "none", message: "Couldn't find a cocktail recipe there.", draft: null, warnings: [], kind };
    }
    return { submission, status: "draft", message: null, draft: result.draft, warnings: result.warnings, kind };
  } catch (err) {
    console.error("extractRecipe failed", err);
    return fail(err instanceof ImportError ? err.userMessage : "Something went wrong. Please try again.");
  }
}

export interface SaveState {
  submission: number;
  draft: RecipeDraft;
  errors: RecipeErrors;
}

export async function saveRecipe(prev: SaveState, formData: FormData): Promise<SaveState> {
  const submission = (prev?.submission ?? 0) + 1;
  const draft = readRecipeForm(formData);
  const back = (errors: RecipeErrors): SaveState => ({ submission, draft, errors });

  const editing = String(formData.get("editSlug") ?? "");
  const taster = await requireTaster();
  if (!taster) return back({ form: "Only JB & GM can add or edit recipes." });

  const errors = validateRecipe(draft);
  if (hasErrors(errors)) return back(errors);

  const db = await createSupabaseServerClient();
  const row = toCocktailRow(draft);
  let slug: string;

  if (editing) {
    if (!SLUG_PATTERN.test(editing)) return back({ form: "That recipe can't be edited." });
    const { data, error } = await db
      .from("cocktails")
      .update(row)
      .eq("slug", editing)
      .eq("source", "ours")
      .select("slug");
    if (error) return back(saveError(error, draft.name));
    if (!data || data.length === 0) return back({ form: "That recipe can't be edited (it may have been deleted)." });
    slug = editing;
  } else {
    const { data: existing, error: readError } = await db.from("cocktails").select("slug");
    if (readError) return back({ form: "Saving failed. Please try again." });
    slug = uniqueSlug(draft.name, new Set([...RESERVED_SLUGS, ...(existing ?? []).map((r) => r.slug as string)]));
    const { error } = await db.from("cocktails").insert({ ...row, slug, source: "ours", added_by: taster.id });
    if (error) return back(saveError(error, draft.name));
  }

  // Collections (only when the form showed them; otherwise they're left alone).
  let collectionsOk = true;
  if (formData.get("collectionsShown") === "1") {
    collectionsOk = await syncCollections(db, slug, draft.collections, readShownCollections(formData));
  }

  revalidatePath("/");
  revalidatePath(`/cocktails/${slug}`);
  redirect(`/cocktails/${slug}?recipe=${editing ? "saved" : "added"}${collectionsOk ? "" : "&collections=error"}`);
}

/** Puts a recipe in exactly the picked collections (ids checked against the real list). */
async function syncCollections(
  db: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slug: string,
  picks: string[],
  shown: string[]
): Promise<boolean> {
  try {
    const [{ data: drink, error: drinkError }, { data: cols, error: colError }] = await Promise.all([
      db.from("cocktails").select("id").eq("slug", slug).maybeSingle(),
      db.from("collections").select("id"),
    ]);
    if (drinkError || colError || !drink) throw drinkError ?? colError ?? new Error("recipe not found");
    const known = new Set(((cols ?? []) as { id: string }[]).map((c) => c.id));
    const picked = picks.filter((id) => known.has(id));
    const { data: rows, error: memError } = await db
      .from("cocktail_collections")
      .select("collection_id")
      .eq("cocktail_id", drink.id);
    if (memError) throw memError;
    const { add, remove } = planMembershipChange(
      ((rows ?? []) as { collection_id: string }[]).map((r) => r.collection_id),
      picked,
      shown
    );
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
      const { error } = await db.from("cocktail_collections").delete().eq("cocktail_id", drink.id).in("collection_id", remove);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.error("saveRecipe: collections failed", err);
    return false;
  }
}

function saveError(error: { code?: string; message?: string }, name: string): RecipeErrors {
  console.error("saveRecipe failed", error);
  if (error.code === "23505" && /name/.test(error.message ?? "")) {
    return { name: `There's already a drink called “${name}”. Try a different name, e.g. add who it's by.` };
  }
  return { form: "Saving failed. Please try again." };
}

export async function deleteRecipe(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const taster = await requireTaster();
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  if (!taster) redirect(`/cocktails/${slug}`);
  if (formData.get("confirm") !== "yes") redirect(`/cocktails/${slug}/edit?delete=confirm`);
  const db = await createSupabaseServerClient();
  // RLS (migration 0008) only lets the taster who added it delete it.
  const { data, error } = await db
    .from("cocktails")
    .delete()
    .eq("slug", slug)
    .eq("source", "ours")
    .eq("added_by", taster.id)
    .select("slug");
  if (error || !data || data.length === 0) {
    console.error("deleteRecipe failed", error);
    redirect(`/cocktails/${slug}/edit?delete=error`);
  }
  revalidatePath("/");
  redirect("/?recipe=deleted");
}
