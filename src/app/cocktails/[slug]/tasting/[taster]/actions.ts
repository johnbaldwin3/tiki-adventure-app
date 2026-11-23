"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { SLUG_PATTERN } from "@/lib/slug";
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
 * Saves one taster's tasting for one cocktail -- your own, or (household
 * rule, migration 0016) the other taster's, e.g. when you tried it together.
 * "We both tried it" also marks the other taster as having tried it, without
 * touching their rating or notes, so they're prompted to rate it.
 * Server Actions can be POSTed to directly, so everything is re-checked
 * here; writes run as the signed-in user (RLS: tasters only, and the
 * database records who entered it).
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
  if (!user.taster) return fail("This account isn't set up for tastings yet.");

  const db = await createSupabaseServerClient();
  const [{ data: cocktail, error: cocktailError }, { data: tasters, error: tastersError }] = await Promise.all([
    db.from("cocktails").select("id").eq("slug", slug).maybeSingle(),
    db.from("tasters").select("id, initials, household_id"),
  ]);
  if (cocktailError || !cocktail) return fail("Couldn't find that cocktail. Nothing was saved.");
  const visible = (tastersError ? [] : (tasters ?? [])) as { id: string; initials: string; household_id: string | null }[];
  // Your household only: friends' tastings are theirs to enter (RLS agrees).
  const myHousehold = visible.find((t) => t.id === user.taster!.id)?.household_id ?? null;
  const everyone = visible.filter((t) => myHousehold !== null && t.household_id === myHousehold);
  const target = everyone.find((t) => t.initials === initials);
  if (!target) return fail("That cocktail or taster wasn't recognized.");

  const { error } = await db.from("tastings").upsert(
    {
      cocktail_id: cocktail.id,
      taster_id: target.id,
      tried: parsed.value.tried,
      rating: parsed.value.rating,
      tasted_at: parsed.value.tastedAt,
      notes: parsed.value.notes,
    },
    { onConflict: "cocktail_id,taster_id" }
  );
  if (error) return fail("Saving failed. Please try again.");

  // "We both tried it": mark the other taster(s) as having tried it too, so
  // they're asked for their rating. Their rating, notes and date are kept.
  let partial = false;
  if (formData.get("bothTried") === "on" && parsed.value.tried) {
    const others = everyone.filter((t) => t.id !== target.id);
    const { data: theirs, error: readError } = others.length
      ? await db.from("tastings").select("taster_id, tried, tasted_at").eq("cocktail_id", cocktail.id)
      : { data: [], error: null };
    const rows = (readError ? null : (theirs ?? [])) as { taster_id: string; tried: boolean; tasted_at: string | null }[] | null;
    if (!rows) partial = true;
    for (const other of rows ? others : []) {
      const row = rows!.find((r) => r.taster_id === other.id);
      if (row?.tried) continue;
      const { error: otherError } = await db.from("tastings").upsert(
        {
          cocktail_id: cocktail.id,
          taster_id: other.id,
          tried: true,
          ...(row?.tasted_at ? {} : { tasted_at: parsed.value.tastedAt }),
        },
        { onConflict: "cocktail_id,taster_id" }
      );
      if (otherError) partial = true;
    }
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/cocktails/${slug}`);
  redirect(`/cocktails/${slug}${partial ? "?tasting=partial" : ""}#tasting`);
}
