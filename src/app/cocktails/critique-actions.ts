"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { parseIngredients } from "@/lib/cocktails";
import { describeCritique, readCritiqueForm, readTrialForm, toStoredLines, type Proposal } from "@/lib/critique";
import type { RecipeLine } from "@/lib/recipe-form";
import { ImportError } from "@/lib/server/recipe-ai";
import { suggestTweaks } from "@/lib/server/critique-ai";
import { withParam } from "@/lib/shopping";
import { SLUG_PATTERN } from "@/lib/slug";
import { applyStyleOverrides, computeStyles, getStyleTag, type StyleOverride } from "@/lib/styles";
import { fetchStyleOverrides } from "@/lib/styles-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { mapVersions, VERSION_COLUMNS, type RawVersionRow } from "@/lib/versions";

/**
 * Critique a recipe (phase 21): the recipe helper suggests small changes
 * (nothing saved), the tasters save them -- edited if they like -- as a
 * trial, then keep it as "our version" or drop it. The verified original
 * in cocktails.ingredients is never written here; versions live in
 * cocktail_versions (migration 0014) and change only through its
 * functions, run as the signed-in taster so RLS applies. Every input is
 * re-checked: actions can be POSTed directly.
 */

const VERSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CritiqueState {
  submission: number;
  status: "idle" | "proposal" | "none" | "error";
  message: string | null;
  proposal: Proposal | null;
  /** The lines the proposal was made from (for the before/after). */
  before: RecipeLine[];
  /** How we described it, saved with the trial. */
  critique: string;
}

async function loadDrink(slug: string) {
  const db = await createSupabaseServerClient();
  const { data: drink, error } = await db
    .from("cocktails")
    .select("id, name, ingredients, method_summary")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!drink) return null;
  const { data: rows, error: vError } = await db
    .from("cocktail_versions")
    .select(VERSION_COLUMNS)
    .eq("cocktail_id", drink.id)
    .in("status", ["trial", "active"]);
  if (vError) throw vError;
  const versions = mapVersions((rows ?? []) as RawVersionRow[]).get(drink.id) ?? {};
  return { db, drink: drink as { id: string; name: string; ingredients: unknown; method_summary: string | null }, versions };
}

const asLines = (l: { amount: string; unit: string; ingredient: string; catalogId: string | null }[]): RecipeLine[] =>
  l.map((x) => ({ amount: x.amount, unit: x.unit, ingredient: x.ingredient, catalogId: x.catalogId ?? "" }));

export async function critiqueRecipe(prev: CritiqueState, formData: FormData): Promise<CritiqueState> {
  const submission = (prev?.submission ?? 0) + 1;
  const fail = (message: string, status: "error" | "none" = "error"): CritiqueState => ({
    submission,
    status,
    message,
    proposal: null,
    before: [],
    critique: "",
  });
  const slug = String(formData.get("slug") ?? "");
  if (!SLUG_PATTERN.test(slug)) return fail("That drink couldn't be found.");
  const user = await getSignedInUser();
  if (!user?.taster) return fail("Only JB & GM can critique recipes.");
  const critique = readCritiqueForm(formData);
  if (!critique) return fail("Pick what was off, or say it in a few words.");

  try {
    const loaded = await loadDrink(slug);
    if (!loaded) return fail("That drink couldn't be found.");
    const { drink, versions } = loaded;
    // What we tasted: the trial if we're critiquing it, else our version, else the original.
    const base = formData.get("base") === "trial" && versions.trial ? versions.trial : versions.active;
    const before = asLines(base ? base.ingredients : parseIngredients(drink.ingredients));
    const method = base?.methodSummary ?? drink.method_summary;
    const fixes = (await fetchStyleOverrides().catch(() => new Map<string, StyleOverride[]>())).get(drink.id) ?? [];
    const styles = applyStyleOverrides(computeStyles(before.map((l) => ({ ...l, catalogId: l.catalogId || null }))), fixes).map(
      (id) => getStyleTag(id)?.label ?? id
    );
    const proposal = await suggestTweaks({ name: drink.name, lines: before, method, styles, critique });
    if (!proposal) return fail("The recipe helper didn't suggest any changes. Try saying a bit more about what was off.", "none");
    return { submission, status: "proposal", message: null, proposal, before, critique: describeCritique(critique) };
  } catch (err) {
    console.error("critiqueRecipe failed", err);
    return fail(err instanceof ImportError ? err.userMessage : "Something went wrong. Please try again.");
  }
}

function back(slug: string, status: string): never {
  revalidatePath("/");
  revalidatePath(`/cocktails/${slug}`);
  redirect(`${withParam(`/cocktails/${slug}`, "tweak", status)}#our-version`);
}

async function requireTasterFor(slug: string) {
  const user = await getSignedInUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cocktails/${slug}`)}`);
  return user.taster ?? null;
}

/**
 * Saves the (possibly edited) suggestion as this drink's trial, replacing
 * the trial the taster saw (`replaces`, "" if none) in one transaction. If
 * the other taster saved a different trial meanwhile, nothing changes.
 */
export async function saveTrial(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  const taster = await requireTasterFor(slug);
  if (!taster) back(slug, "error");
  const draft = readTrialForm(formData);
  if (!draft) back(slug, "empty");
  const replaces = String(formData.get("replaces") ?? "");
  if (replaces && !VERSION_ID.test(replaces)) back(slug, "error");
  let status = "saved";
  try {
    const loaded = await loadDrink(slug);
    if (!loaded) redirect("/");
    const { error } = await loaded.db.rpc("save_cocktail_trial", {
      p_cocktail_id: loaded.drink.id,
      p_ingredients: toStoredLines(draft.lines),
      p_method_summary: draft.method,
      p_critique: draft.critique,
      p_reasoning: draft.reasoning,
      p_replaces: replaces || null,
    });
    if (error?.message === "stale") status = "stale";
    else if (error) throw error;
  } catch (err) {
    unstable_rethrow(err);
    console.error("saveTrial failed", err);
    status = "error";
  }
  back(slug, status);
}

/** Keep it / Drop it / Go back to the original. */
async function decide(formData: FormData, kind: "keep" | "drop" | "revert"): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  const versionId = String(formData.get("versionId") ?? "");
  const taster = await requireTasterFor(slug);
  if (!taster || !VERSION_ID.test(versionId)) back(slug, "error");
  let status = kind === "keep" ? "kept" : kind === "drop" ? "dropped" : "reverted";
  try {
    const loaded = await loadDrink(slug);
    if (!loaded) redirect("/");
    // The version must be this drink's current trial (keep/drop) or our version (revert).
    const target = kind === "revert" ? loaded.versions.active : loaded.versions.trial;
    if (target?.id !== versionId) {
      status = "stale";
    } else {
      const { error } = await loaded.db.rpc(kind === "keep" ? "keep_cocktail_version" : "retire_cocktail_version", {
        p_version_id: versionId,
      });
      if (error?.code === "P0002") status = "stale";
      else if (error) throw error;
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error(`${kind} version failed`, err);
    status = "error";
  }
  back(slug, status);
}

export async function keepTrial(formData: FormData): Promise<void> {
  return decide(formData, "keep");
}
export async function dropTrial(formData: FormData): Promise<void> {
  return decide(formData, "drop");
}
export async function revertToOriginal(formData: FormData): Promise<void> {
  return decide(formData, "revert");
}
