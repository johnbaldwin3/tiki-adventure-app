"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { hasErrors, readRecipeForm, toCocktailRow, uniqueSlug, validateRecipe, type RecipeDraft, type RecipeErrors } from "@/lib/recipe-form";
import type { ImportKind } from "@/lib/recipe-import";
import { importRecipe, ImportError } from "@/lib/server/recipe-ai";
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
  const kind: ImportKind = k === "photo" || k === "link" ? k : "text";
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

  revalidatePath("/");
  revalidatePath(`/cocktails/${slug}`);
  redirect(`/cocktails/${slug}?recipe=${editing ? "saved" : "added"}`);
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
