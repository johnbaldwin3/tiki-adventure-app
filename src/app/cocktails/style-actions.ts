"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { parseIngredients } from "@/lib/cocktails";
import { withParam } from "@/lib/shopping";
import { SLUG_PATTERN } from "@/lib/slug";
import { computeStyles, getStyleTag, overridesFor } from "@/lib/styles";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Saves a taster's fixes to one drink's style tags. The computed tags are
 * worked out here from the stored recipe (never trusted from the form), and
 * only the differences are stored (migration 0013), so later rule
 * improvements still apply to everything the tasters didn't change.
 */
export async function setDrinkStyles(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  if (!SLUG_PATTERN.test(slug)) redirect("/");
  const returnTo = `/cocktails/${slug}`;
  const user = await getSignedInUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!user.taster) redirect(`${withParam(returnTo, "styles", "error")}#style`);
  const chosen = [
    ...new Set(formData.getAll("style").filter((v): v is string => typeof v === "string" && !!getStyleTag(v))),
  ];
  // Exactly one build (the form uses radio buttons; a hand-made POST might not).
  if (chosen.filter((t) => getStyleTag(t)!.group === "structure").length !== 1) {
    redirect(`${withParam(returnTo, "styles", "error")}#style`);
  }
  let status = "saved";
  try {
    const db = await createSupabaseServerClient();
    const { data: drink, error } = await db.from("cocktails").select("id, ingredients").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!drink) redirect("/");
    const overrides = overridesFor(computeStyles(parseIngredients(drink.ingredients)), chosen);
    // Write the new fixes first (upsert), then drop any others: a failure
    // part-way never loses the fixes that were there.
    if (overrides.length > 0) {
      const { error: upError } = await db
        .from("cocktail_style_overrides")
        .upsert(
          overrides.map((o) => ({ cocktail_id: drink.id, tag: o.tag, include: o.include, updated_by: user.taster!.id })),
          { onConflict: "cocktail_id,tag" }
        );
      if (upError) throw upError;
    }
    let stale = db.from("cocktail_style_overrides").delete().eq("cocktail_id", drink.id);
    if (overrides.length > 0) stale = stale.not("tag", "in", `(${overrides.map((o) => o.tag).join(",")})`);
    const { error: delError } = await stale;
    if (delError) throw delError;
  } catch (err) {
    unstable_rethrow(err);
    console.error("setDrinkStyles failed", err);
    status = "error";
  }
  revalidatePath("/");
  revalidatePath(returnTo);
  redirect(`${withParam(returnTo, "styles", status)}#style`);
}
