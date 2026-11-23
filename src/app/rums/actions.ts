"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { getIngredient } from "@/lib/ingredients";
import { rumCheckFromBook, RUM_CHECK_LIMITS, type RumCheck } from "@/lib/rum-check";
import { getScCategory, isRumStyle } from "@/lib/rum-numbers";
import { ImportError } from "@/lib/server/recipe-ai";
import { classifyRum } from "@/lib/server/rum-check-ai";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The rum checker: "what Smuggler's Cove number is this bottle?" from a
 * name or a photo (nothing saved), and labelling a bottle in our bar with
 * the answer (cabinet_items.rum_category, migration 0015, as the taster).
 */

const MAX_IMAGE_CHARS = 4_000_000;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export interface RumCheckState {
  submission: number;
  status: "idle" | "answer" | "none" | "error";
  message: string | null;
  answer: RumCheck | null;
}

export async function checkRum(prev: RumCheckState, formData: FormData): Promise<RumCheckState> {
  const submission = (prev?.submission ?? 0) + 1;
  const fail = (message: string, status: "error" | "none" = "error"): RumCheckState => ({ submission, status, message, answer: null });
  const user = await getSignedInUser();
  if (!user?.taster) return fail("Only members can use the rum checker.");
  const name = String(formData.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, RUM_CHECK_LIMITS.name);
  const image = String(formData.get("image") ?? "");
  const hasImage = image !== "";
  if (hasImage && (image.length > MAX_IMAGE_CHARS || !IMAGE.test(image))) return fail("That photo couldn't be used. Try a smaller JPEG or PNG.");
  if (!name && !hasImage) return fail("Take a photo of the bottle, or type its name.");

  // A bottle the book lists needs no AI (and no photo).
  if (!hasImage) {
    const fromBook = rumCheckFromBook(name);
    if (fromBook) return { submission, status: "answer", message: null, answer: fromBook };
  }
  try {
    const answer = await classifyRum({ name, imageDataUrl: hasImage ? image : undefined });
    return answer
      ? { submission, status: "answer", message: null, answer }
      : fail("Couldn't find a rum there. Try a clearer photo of the label, or type the name.", "none");
  } catch (err) {
    console.error("checkRum failed", err);
    return fail(err instanceof ImportError ? err.userMessage : "Something went wrong. Please try again.");
  }
}

/** Labels one of our bar's rums with a category (or clears the label: category ""). */
export async function labelBarRum(formData: FormData): Promise<void> {
  const back = (status: string): never => redirect(`/rums?labeled=${status}#our-rums`);
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Frums");
  const taster = user.taster;
  if (!taster) back("error");
  const id = String(formData.get("ingredient") ?? "");
  const category = String(formData.get("category") ?? "");
  const ing = getIngredient(id);
  if (!ing || !isRumStyle(id, ing.family) || (category !== "" && !getScCategory(category))) back("error");
  const bottle = String(formData.get("bottle") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  // From the checker's answer: "book" or "ai"; a pick from the list is ours.
  const given = formData.get("basis");
  const basis = given === "book" || given === "ai" ? given : "ours";
  let status = category ? "saved" : "cleared";
  try {
    const db = await createSupabaseServerClient();
    const patch: Record<string, string | null> = {
      rum_category: category || null,
      rum_category_basis: category ? basis : null,
      updated_by: taster!.id,
    };
    // Name the bottle too, when the taster ticks it (from the checker's answer).
    if (bottle && formData.get("nameBottle") === "on") patch.bottle = bottle;
    const { data, error } = await db.from("cabinet_items").update(patch).eq("ingredient_id", id).select("ingredient_id");
    if (error) throw error;
    if (!data || data.length === 0) status = "missing";
  } catch (err) {
    unstable_rethrow(err);
    console.error("labelBarRum failed", err);
    status = "error";
  }
  revalidatePath("/rums");
  revalidatePath("/cabinet");
  back(status);
}
