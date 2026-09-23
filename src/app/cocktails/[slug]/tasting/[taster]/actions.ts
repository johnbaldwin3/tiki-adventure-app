"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { SLUG_PATTERN } from "@/lib/slug";
import { supabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  parseTastingForm,
  readTastingForm,
  todayInEastern,
  type TastingFormErrors,
  type TastingFormValues,
} from "@/lib/tasting-form";

export interface TastingFormState {
  status: "idle" | "invalid" | "error";
  /** Increments on every submit so the form re-mounts and re-announces, even for a repeat result. */
  submission: number;
  values: TastingFormValues;
  errors: TastingFormErrors;
  message: string | null;
}

/**
 * Saves the signed-in taster's own tasting for one cocktail (Phase 7).
 * Server Actions can be POSTed to directly, so everything is re-checked
 * here: the form, who's signed in, and that they're editing their own
 * tasting. The write itself runs as the signed-in user, so the database's
 * RLS policies (migration 0003) enforce the same rule a second time.
 */
export async function saveTasting(
  prev: TastingFormState,
  formData: FormData
): Promise<TastingFormState> {
  const submission = (prev?.submission ?? 0) + 1;
  const values = readTastingForm(formData);
  const slug = String(formData.get("slug") ?? "");
  const initials = String(formData.get("taster") ?? "").toUpperCase();
  const fail = (message: string): TastingFormState => ({ status: "error", submission, values, errors: {}, message });

  if (!SLUG_PATTERN.test(slug) || !/^[A-Z]{2,3}$/.test(initials)) {
    return fail("That cocktail or taster wasn't recognized.");
  }

  const parsed = parseTastingForm(values, todayInEastern());
  if (!parsed.ok) {
    return { status: "invalid", submission, values, errors: parsed.errors, message: "Please fix the highlighted fields." };
  }

  const user = await getSignedInUser();
  if (!user) return fail("Your sign-in has expired. Please sign in again, then save.");
  if (!user.taster || user.taster.initials !== initials) {
    return fail("You can only save your own tasting.");
  }

  const { data: cocktail, error: cocktailError } = await supabase
    .from("cocktails")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (cocktailError || !cocktail) return fail("Couldn't find that cocktail. Nothing was saved.");

  const db = await createSupabaseServerClient();
  const { error } = await db.from("tastings").upsert(
    {
      cocktail_id: cocktail.id,
      taster_id: user.taster.id,
      tried: parsed.value.tried,
      rating: parsed.value.rating,
      tasted_at: parsed.value.tastedAt,
      notes: parsed.value.notes,
    },
    { onConflict: "cocktail_id,taster_id" }
  );
  if (error) return fail("Saving failed. Please try again.");

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/cocktails/${slug}`);
  redirect(`/cocktails/${slug}#tasting`);
}
