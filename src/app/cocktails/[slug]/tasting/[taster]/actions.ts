"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";
import { SLUG_PATTERN } from "@/lib/slug";
import {
  parseTastingForm,
  readTastingForm,
  tastingWritesEnabled,
  todayInEastern,
  type TastingFormErrors,
  type TastingFormValues,
} from "@/lib/tasting-form";

export interface TastingFormState {
  status: "idle" | "invalid" | "preview" | "error";
  /** Increments on every submit so the form re-mounts and re-announces, even for a repeat result. */
  submission: number;
  values: TastingFormValues;
  errors: TastingFormErrors;
  message: string | null;
}

/**
 * Saves one taster's tasting for one cocktail. Server Actions are reachable
 * by direct POST, so everything is re-validated here and the write is gated
 * by tastingWritesEnabled() (off in production until Phase 7 sign-in).
 */
export async function saveTasting(
  prev: TastingFormState,
  formData: FormData
): Promise<TastingFormState> {
  const submission = (prev?.submission ?? 0) + 1;
  const values = readTastingForm(formData);
  const slug = String(formData.get("slug") ?? "");
  const initials = String(formData.get("taster") ?? "").toUpperCase();

  if (!SLUG_PATTERN.test(slug) || !/^[A-Z]{2,3}$/.test(initials)) {
    return { status: "error", submission, values, errors: {}, message: "That cocktail or taster wasn't recognized." };
  }

  const parsed = parseTastingForm(values, todayInEastern());
  if (!parsed.ok) {
    return {
      status: "invalid",
      submission,
      values,
      errors: parsed.errors,
      message: "Please fix the highlighted fields.",
    };
  }

  if (!tastingWritesEnabled(process.env)) {
    return {
      status: "preview",
      submission,
      values,
      errors: {},
      message:
        "Looks good, but this wasn't saved. Saving turns on once sign-in is added, so only JB and GM can change tastings.",
    };
  }

  const [{ data: cocktail, error: cocktailError }, { data: taster, error: tasterError }] =
    await Promise.all([
      supabase.from("cocktails").select("id").eq("slug", slug).maybeSingle(),
      supabase.from("tasters").select("id").eq("initials", initials).maybeSingle(),
    ]);
  if (cocktailError || tasterError || !cocktail || !taster) {
    return { status: "error", submission, values, errors: {}, message: "Couldn't find that cocktail or taster. Nothing was saved." };
  }

  const { error } = await createAdminClient()
    .from("tastings")
    .upsert(
      {
        cocktail_id: cocktail.id,
        taster_id: taster.id,
        tried: parsed.value.tried,
        rating: parsed.value.rating,
        tasted_at: parsed.value.tastedAt,
        notes: parsed.value.notes,
      },
      { onConflict: "cocktail_id,taster_id" }
    );
  if (error) {
    return { status: "error", submission, values, errors: {}, message: "Saving failed. Please try again." };
  }

  // The pages are force-dynamic today; revalidating keeps this correct if
  // caching is ever turned on for them.
  revalidatePath("/");
  revalidatePath(`/cocktails/${slug}`);
  redirect(`/cocktails/${slug}#tasting`);
}
