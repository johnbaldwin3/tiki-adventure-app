"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { safeNextPath } from "@/lib/auth/validate";
import { fetchCocktailBySlug } from "@/lib/cocktails";
import { getIngredient } from "@/lib/ingredients";
import { DEFAULT_SIZE, parseLevel, parseSize, pourLines } from "@/lib/inventory";
import { withParam } from "@/lib/shopping";
import { SLUG_PATTERN } from "@/lib/slug";
import { MAX_SERVINGS } from "@/lib/amounts";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Bar inventory actions: set a bottle's size and level, record "We made
 * this", and undo it. Plain forms (no JavaScript needed). Server Actions
 * can be POSTed to directly, so inputs are re-checked; writes run as the
 * signed-in taster, so the RLS policies and SECURITY INVOKER functions of
 * migration 0009 apply.
 */

async function requireTaster(next: string) {
  const user = await getSignedInUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user.taster;
}

export async function setBottleLevel(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(String(formData.get("returnTo") ?? "/cabinet/levels"));
  const id = String(formData.get("id") ?? "");
  const back = (status: string) => {
    if (!getIngredient(id)) return withParam(returnTo, "levels", status);
    return `${withParam(withParam(returnTo, "levels", status), "id", id)}#level-${id}`;
  };
  const taster = await requireTaster(returnTo);
  if (!taster || !getIngredient(id)) redirect(back("error"));

  const untrack = formData.get("level") === "untrack";
  const size = parseSize(formData.get("size")) ?? DEFAULT_SIZE;
  const level = parseLevel(formData.get("level"));
  if (!untrack && level === null) redirect(back("error"));

  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("cabinet_items")
    .update({
      size_ml: size,
      remaining_ml: untrack ? null : Math.round(size * level! * 10) / 10,
      updated_by: taster.id,
    })
    .eq("ingredient_id", id)
    .select("ingredient_id");
  if (error || !data || data.length === 0) {
    console.error("setBottleLevel failed", error);
    redirect(back("error"));
  }
  revalidatePath("/cabinet");
  redirect(back("saved"));
}

export async function madeThis(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  const servingsRaw = Number(formData.get("servings"));
  const servings = Number.isInteger(servingsRaw) && servingsRaw >= 1 && servingsRaw <= MAX_SERVINGS ? servingsRaw : 1;
  const card = `/cocktails/${slug}${servings > 1 ? `?serves=${servings}` : ""}`;
  const taster = await requireTaster(card);
  if (!taster) redirect(withParam(card, "made", "error"));

  // A key made when the button was rendered: a double-submit records once.
  const pourId = String(formData.get("pourKey") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(pourId)) redirect(withParam(card, "made", "error"));
  const cocktail = await fetchCocktailBySlug(slug).catch(() => null);
  if (!cocktail) redirect(withParam(card, "made", "error"));
  const lines = pourLines(cocktail.ingredients, servings);

  const db = await createSupabaseServerClient();
  const { data: recorded, error } = await db.rpc("record_pour", {
    p_pour_id: pourId,
    p_cocktail_id: cocktail.id,
    p_servings: servings,
    p_lines: lines.map((l) => ({ ingredient_id: l.ingredientId, ml: l.ml })),
  });
  if (error || typeof recorded !== "string") {
    console.error("madeThis failed", error);
    redirect(withParam(card, "made", "error"));
  }
  revalidatePath("/cabinet");
  redirect(`${withParam(card, "made", recorded)}#made`);
}

export async function undoPour(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const pourId = String(formData.get("pourId") ?? "");
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  const servingsRaw = Number(formData.get("servings"));
  const servings = Number.isInteger(servingsRaw) && servingsRaw > 1 && servingsRaw <= MAX_SERVINGS ? servingsRaw : 1;
  const card = `/cocktails/${slug}${servings > 1 ? `?serves=${servings}` : ""}`;
  const taster = await requireTaster(card);
  if (!taster || !/^[0-9a-f-]{36}$/i.test(pourId)) redirect(withParam(card, "made", "error"));
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("undo_pour", { p_pour_id: pourId });
  if (error) {
    console.error("undoPour failed", error);
    redirect(withParam(card, "made", "error"));
  }
  // false: it was already undone (e.g. by the other taster, or a second tap).
  if (data !== true) redirect(`${withParam(card, "made", "gone")}#made`);
  revalidatePath("/cabinet");
  redirect(`${withParam(card, "made", "undone")}#made`);
}
