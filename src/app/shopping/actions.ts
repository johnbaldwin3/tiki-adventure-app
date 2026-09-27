"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { safeNextPath } from "@/lib/auth/validate";
import { getIngredient } from "@/lib/ingredients";
import { withParam } from "@/lib/shopping";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Shopping-list actions, used by plain <form>s (they work without
 * JavaScript). Server Actions can be POSTed to directly, so ids are
 * re-checked against the catalog and the return path must be local; the
 * writes run as the signed-in taster, so the RLS policies (migrations
 * 0006/0007) apply too. Each redirects back to where it was used.
 */

/** Catalog ingredients that can be bought (staples are assumed on hand). */
function listedIds(formData: FormData): string[] {
  return [
    ...new Set(
      formData
        .getAll("id")
        .slice(0, 200)
        .filter((v): v is string => typeof v === "string")
        .filter((id) => {
          const i = getIngredient(id);
          return !!i && !i.staple;
        })
    ),
  ];
}

async function requireTaster(returnTo: string) {
  const user = await getSignedInUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (!user.taster) redirect(withParam(returnTo, "shopping", "error"));
  return user.taster;
}

function done(returnTo: string, status: string): never {
  revalidatePath("/shopping");
  revalidatePath("/cabinet");
  redirect(withParam(returnTo, "shopping", status));
}

export async function addToShopping(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(String(formData.get("returnTo") ?? "/shopping"));
  const taster = await requireTaster(returnTo);
  const ids = listedIds(formData);
  if (ids.length === 0) redirect(withParam(returnTo, "shopping", "error"));
  const db = await createSupabaseServerClient();
  const { error } = await db
    .from("shopping_items")
    .upsert(
      ids.map((id) => ({ ingredient_id: id, added_by: taster.id })),
      { onConflict: "ingredient_id", ignoreDuplicates: true }
    );
  if (error) {
    console.error("addToShopping failed", error);
    redirect(withParam(returnTo, "shopping", "error"));
  }
  done(returnTo, "added");
}

export async function removeFromShopping(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(String(formData.get("returnTo") ?? "/shopping"));
  await requireTaster(returnTo);
  const ids = listedIds(formData);
  if (ids.length === 0) redirect(withParam(returnTo, "shopping", "error"));
  const db = await createSupabaseServerClient();
  const { error } = await db.from("shopping_items").delete().in("ingredient_id", ids);
  if (error) {
    console.error("removeFromShopping failed", error);
    redirect(withParam(returnTo, "shopping", "error"));
  }
  done(returnTo, "removed");
}

/** "Got it": into the bar (keeping any bottle already noted there; a tracked bottle is refilled), off the list. */
export async function boughtShoppingItem(formData: FormData): Promise<void> {
  const returnTo = safeNextPath(String(formData.get("returnTo") ?? "/shopping"));
  const taster = await requireTaster(returnTo);
  const ids = listedIds(formData);
  if (ids.length === 0) redirect(withParam(returnTo, "shopping", "error"));
  const db = await createSupabaseServerClient();
  const { error: addError } = await db
    .from("cabinet_items")
    .upsert(
      ids.map((id) => ({ ingredient_id: id, bottle: null, updated_by: taster.id })),
      { onConflict: "ingredient_id", ignoreDuplicates: true }
    );
  if (addError) {
    console.error("boughtShoppingItem: cabinet add failed", addError);
    redirect(withParam(returnTo, "shopping", "error"));
  }
  // A new bottle of something we track: refill its level.
  const { data: tracked } = await db
    .from("cabinet_items")
    .select("ingredient_id, size_ml, remaining_ml")
    .in("ingredient_id", ids)
    .not("remaining_ml", "is", null)
    .not("size_ml", "is", null);
  for (const row of ((tracked ?? []) as { ingredient_id: string; size_ml: number | string | null; remaining_ml: unknown }[]).filter(
    (r) => ids.includes(r.ingredient_id) && r.size_ml != null && r.remaining_ml != null
  )) {
    const { error } = await db
      .from("cabinet_items")
      .update({ remaining_ml: Number(row.size_ml), updated_by: taster.id })
      .eq("ingredient_id", row.ingredient_id);
    if (error) console.error("boughtShoppingItem: refill failed", error);
  }
  const { error: removeError } = await db.from("shopping_items").delete().in("ingredient_id", ids);
  if (removeError) {
    console.error("boughtShoppingItem: list remove failed", removeError);
    redirect(withParam(returnTo, "shopping", "error"));
  }
  done(returnTo, "bought");
}
