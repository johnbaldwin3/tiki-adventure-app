import Link from "next/link";
import { madeThis, undoPour } from "@/app/cabinet/inventory-actions";
import type { Inventory, PourRecord } from "@/lib/cabinet-data";
import { getIngredient } from "@/lib/ingredients";
import { describeLeft, isLow, type PourLine } from "@/lib/inventory";
import { FocusMessage } from "./focus-message";
import { SubmitButton } from "./submit-button";

const name = (id: string) => getIngredient(id)?.name ?? id;
const ml = (n: number) => `${Math.round(n * 10) / 10} ml`;

function MadeForm({ slug, servings, label }: { slug: string; servings: number; label: string }) {
  return (
    <form action={madeThis} className="mt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="servings" value={servings} />
      {/* A fresh key per render: a double-submit of this form records once. */}
      <input type="hidden" name="pourKey" value={crypto.randomUUID()} />
      <SubmitButton pendingText="Recording…" className="rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm">
        {label}
      </SubmitButton>
    </form>
  );
}

/**
 * "We made this" on the recipe card (tasters only): records what the
 * chosen number of drinks pours, counting down tracked bottles in our bar.
 * After a pour, shows what changed, anything now running low, and Undo.
 */
export function MadeThis({
  slug,
  servings,
  lines,
  inventory,
  made,
  pour,
}: {
  slug: string;
  servings: number;
  lines: PourLine[];
  inventory: Inventory;
  /** ?made= : a pour id, "undone", "gone" or "error". */
  made: string | undefined;
  pour: PourRecord | null;
}) {
  const tracked = lines.filter((l) => inventory.get(l.ingredientId)?.remainingMl != null);
  const untracked = lines.filter((l) => !tracked.includes(l));
  const drinks = `${servings} ${servings === 1 ? "drink" : "drinks"}`;
  const countedDown = pour?.lines.filter((l) => l.takenMl > 0) ?? [];

  return (
    <section id="made" aria-labelledby="made-heading" className="scroll-mt-4 rounded-2xl bg-card p-4 shadow-sm">
      <h2 id="made-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        Making it
      </h2>

      {made === "error" && (
        <FocusMessage role="alert" className="mt-2 rounded-xl border border-coral/30 p-3 text-sm text-coral-deep">
          Couldn&apos;t record that. Please try again.
        </FocusMessage>
      )}
      {made === "undone" && (
        <FocusMessage role="status" className="mt-2 rounded-xl border border-teal/30 p-3 text-sm text-teal-deep">
          Undone — what was taken is back in our bar.
        </FocusMessage>
      )}
      {made === "gone" && (
        <FocusMessage role="status" className="mt-2 rounded-xl border border-teal/30 p-3 text-sm text-teal-deep">
          That was already undone.
        </FocusMessage>
      )}
      {pour && (
        <FocusMessage role="status" className="mt-2 rounded-xl border border-teal/30 p-3 text-sm text-teal-deep">
          <span className="font-semibold">
            Cheers! Recorded {pour.servings} {pour.servings === 1 ? "drink" : "drinks"}.
          </span>
          {countedDown.length > 0 ? (
            <span className="mt-1 block text-ink">
              {countedDown
                .map((l) => {
                  const level = inventory.get(l.ingredientId) ?? { sizeMl: null, remainingMl: null };
                  const ranOut = l.takenMl < l.ml ? " (it ran out)" : "";
                  const left = describeLeft(level);
                  return `${name(l.ingredientId)}: −${ml(l.takenMl)}${ranOut}${left ? `, ${left}` : ""}${isLow(level) ? " (running low)" : ""}`;
                })
                .join(". ")}
              .
            </span>
          ) : (
            <span className="mt-1 block text-ink-soft">None of its bottles are tracked, so nothing was counted down.</span>
          )}
        </FocusMessage>
      )}
      {pour && (
        <form action={undoPour} className="mt-1">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="pourId" value={pour.id} />
          <input type="hidden" name="servings" value={servings} />
          <SubmitButton pendingText="Undoing…" className="min-h-8 px-1 text-sm font-semibold text-teal underline underline-offset-2">
            Undo
          </SubmitButton>
        </form>
      )}

      <p className="mt-2 text-sm text-ink-soft">
        {tracked.length > 0
          ? `Counts down our bar: ${tracked.map((l) => `${name(l.ingredientId)} ${ml(l.ml)}`).join(", ")}.`
          : "None of this drink's bottles have levels set, so nothing will be counted down."}
        {untracked.length > 0 && tracked.length > 0 && ` Not tracked: ${untracked.map((l) => name(l.ingredientId)).join(", ")}.`}{" "}
        <Link href="/cabinet/levels" className="font-semibold text-teal underline underline-offset-2">
          Bottle levels
        </Link>
      </p>
      <MadeForm slug={slug} servings={servings} label={pour ? `Made another round (${drinks})` : `We made this (${drinks})`} />
    </section>
  );
}
