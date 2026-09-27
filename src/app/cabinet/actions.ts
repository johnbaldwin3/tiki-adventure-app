"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { planCabinetSave, readCabinetForm, type CabinetFormValues } from "@/lib/cabinet";
import { getIngredient } from "@/lib/ingredients";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface CabinetFormState {
  /** Increments on every failed submit so the form re-mounts and re-announces. */
  submission: number;
  /** What was submitted, echoed back on failure so nothing typed is lost. */
  values: CabinetFormValues | null;
  message: string | null;
}

const SAVE_FAILED = "Saving failed. Please try again.";

/** Catalog ingredients the form lists (staples are assumed on hand). */
function isListed(id: string): boolean {
  const i = getIngredient(id);
  return !!i && !i.staple;
}

/**
 * Saves the changes made on the "Edit our bar" form. Only rows this person
 * changed since the page loaded are written (see planCabinetSave), so two
 * tasters editing at once don't undo each other. Server Actions can be
 * POSTed to directly, so ids are re-checked against the catalog, and the
 * writes run as the signed-in taster so the cabinet RLS policies
 * (migration 0006) apply too.
 */
export async function saveCabinet(prev: CabinetFormState, formData: FormData): Promise<CabinetFormState> {
  const failed = (): CabinetFormState => ({
    submission: (prev?.submission ?? 0) + 1,
    values: readCabinetForm(formData, isListed),
    message: SAVE_FAILED,
  });

  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Fcabinet%2Fedit");
  if (user.lookupFailed) return failed();
  if (!user.taster) redirect("/cabinet");

  const plan = planCabinetSave(formData, isListed);
  const db = await createSupabaseServerClient();

  if (plan.upsert.length > 0) {
    const { error } = await db.from("cabinet_items").upsert(
      plan.upsert.map(({ ingredientId, bottle }) => ({
        ingredient_id: ingredientId,
        bottle,
        updated_by: user.taster!.id,
      })),
      { onConflict: "ingredient_id" }
    );
    if (error) {
      console.error("saveCabinet: upsert failed", error);
      return failed();
    }
  }
  if (plan.remove.length > 0) {
    const { error } = await db.from("cabinet_items").delete().in("ingredient_id", plan.remove);
    if (error) {
      console.error("saveCabinet: delete failed", error);
      return failed();
    }
  }

  revalidatePath("/cabinet");
  redirect("/cabinet?saved=1");
}
