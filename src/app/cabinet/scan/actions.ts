"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { isLow } from "@/lib/inventory";
import { readBottleForm, readReceiptForm, type BottleDraft, type BottleSave, type ReceiptDraft, type RowProblem } from "@/lib/scan";
import { ImportError } from "@/lib/server/recipe-ai";
import { scanBottlePhoto, scanReceiptPhoto } from "@/lib/server/scan-ai";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The bar scanner: read a bottle or receipt photo (returns a draft to
 * check -- nothing is saved), then save what the taster confirmed into our
 * bar with sizes and levels. Inputs are re-checked here; writes run as the
 * signed-in taster (cabinet RLS, migrations 0006/0009).
 */

const MAX_IMAGE_CHARS = 4_000_000;
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export type ScanKind = "bottle" | "receipt";

export interface ScanState {
  submission: number;
  kind: ScanKind;
  status: "idle" | "bottle" | "receipt" | "none" | "error";
  message: string | null;
  bottle: BottleDraft | null;
  receipt: ReceiptDraft | null;
}

async function requireTaster() {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Fcabinet%2Fscan");
  return user.taster;
}

export async function scanPhoto(prev: ScanState, formData: FormData): Promise<ScanState> {
  const submission = (prev?.submission ?? 0) + 1;
  const kind: ScanKind = formData.get("kind") === "receipt" ? "receipt" : "bottle";
  const base = { submission, kind, bottle: null, receipt: null };
  const fail = (message: string): ScanState => ({ ...base, status: "error", message });

  if (!(await requireTaster())) return fail("Only JB & GM can add to our bar.");
  const image = String(formData.get("image") ?? "");
  if (image.length > MAX_IMAGE_CHARS) return fail("That photo is too large. Try a smaller one.");
  if (!IMAGE.test(image)) return fail("Take or choose a photo first.");

  try {
    if (kind === "bottle") {
      const bottle = await scanBottlePhoto(image);
      return bottle
        ? { ...base, status: "bottle", message: null, bottle }
        : { ...base, status: "none", message: "Couldn't find a bottle in that photo." };
    }
    const receipt = await scanReceiptPhoto(image);
    return receipt
      ? { ...base, status: "receipt", message: null, receipt }
      : { ...base, status: "none", message: "Couldn't read a receipt in that photo." };
  } catch (err) {
    console.error("scanPhoto failed", err);
    return fail(err instanceof ImportError ? err.userMessage : "Something went wrong. Please try again.");
  }
}

export interface SaveScanState {
  submission: number;
  message: string | null;
  problems: RowProblem[];
}

async function saveBottles(saves: BottleSave[], tasterId: string): Promise<boolean> {
  const db = await createSupabaseServerClient();
  const { error } = await db.from("cabinet_items").upsert(
    saves.map((s) => ({
      ingredient_id: s.ingredientId,
      bottle: s.bottle,
      size_ml: s.sizeMl,
      remaining_ml: s.remainingMl,
      updated_by: tasterId,
    })),
    { onConflict: "ingredient_id" }
  );
  if (error) {
    console.error("scan save failed", error);
    return false;
  }
  // In the bar now: off the shopping list (best effort) -- unless it's
  // running low, then it stays there to restock.
  const stocked = saves.filter((s) => !isLow({ sizeMl: s.sizeMl, remainingMl: s.remainingMl })).map((s) => s.ingredientId);
  if (stocked.length > 0) {
    const { error: listError } = await db.from("shopping_items").delete().in("ingredient_id", stocked);
    if (listError) console.error("scan: shopping list tidy-up failed", listError);
  }
  revalidatePath("/cabinet");
  revalidatePath("/shopping");
  return true;
}

export async function saveScannedBottle(prev: SaveScanState, formData: FormData): Promise<SaveScanState> {
  const submission = (prev?.submission ?? 0) + 1;
  const taster = await requireTaster();
  if (!taster) return { submission, message: "Only JB & GM can add to our bar.", problems: [] };
  const save = readBottleForm(formData);
  if (!save) return { submission, message: "Pick what it is and its size, then save.", problems: [] };
  if (!(await saveBottles([save], taster.id))) return { submission, message: "Saving failed. Please try again.", problems: [] };
  redirect(`/cabinet/levels?levels=saved&id=${save.ingredientId}#level-${save.ingredientId}`);
}

export async function saveReceipt(prev: SaveScanState, formData: FormData): Promise<SaveScanState> {
  const submission = (prev?.submission ?? 0) + 1;
  const taster = await requireTaster();
  if (!taster) return { submission, message: "Only JB & GM can add to our bar.", problems: [] };
  const { saves, problems } = readReceiptForm(formData);
  if (problems.length > 0) {
    const message = problems.some((p) => p.duplicate)
      ? "Fix the highlighted items: each needs a style and size, and we track one bottle per style (untick the extra)."
      : "Each ticked item needs what it is and its size.";
    return { submission, message, problems };
  }
  if (saves.length === 0) return { submission, message: "Tick at least one item to add.", problems: [] };
  if (!(await saveBottles(saves, taster.id))) return { submission, message: "Saving failed. Please try again.", problems: [] };
  redirect(`/cabinet?scanned=${saves.length}`);
}
