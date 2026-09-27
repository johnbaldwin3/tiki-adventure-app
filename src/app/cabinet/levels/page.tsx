import type { Metadata } from "next";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { FocusMessage } from "@/components/focus-message";
import { LevelMeter } from "@/components/level-meter";
import { PageShell } from "@/components/page-shell";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { fetchBar } from "@/lib/cabinet-data";
import { getIngredient } from "@/lib/ingredients";
import { DEFAULT_SIZE, describeLeft, isLow, LEVEL_CHOICES, SIZE_CHOICES } from "@/lib/inventory";
import { setBottleLevel } from "../inventory-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bottle levels", robots: { index: false } };

const card = "rounded-2xl bg-card p-4 shadow-sm";

export default async function LevelsPage({ searchParams }: PageProps<"/cabinet/levels">) {
  const sp = await searchParams;
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=%2Fcabinet%2Flevels");
  const shell = { back: { href: "/cabinet", label: "Our bar" }, eyebrow: "JB & GM's home bar", title: "Bottle levels", icon: "🍾" };
  if (!user.taster && !user.lookupFailed) redirect("/cabinet");

  let bar: Awaited<ReturnType<typeof fetchBar>> = null;
  if (user.taster) {
    try {
      bar = await fetchBar();
    } catch (err) {
      unstable_rethrow(err);
      console.error("levels: failed to load", err);
    }
  }
  if (!bar) {
    return (
      <PageShell {...shell}>
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t load our bar right now. Please try refreshing the page.
        </p>
      </PageShell>
    );
  }

  const name = (id: string) => getIngredient(id)?.name ?? id;
  // The bottle just saved gets its message (and focus) in its own row.
  const savedId = typeof sp.id === "string" && getIngredient(sp.id) ? sp.id : null;
  const items = [...bar.cabinet.entries()].sort((a, b) => name(a[0]).localeCompare(name(b[0])));

  return (
    <PageShell
      {...shell}
      intro="Set each bottle's size and roughly how much is left. “We made this” on a recipe card then counts it down."
    >
      {sp.levels === "error" && !savedId && (
        <FocusMessage role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t save that. Please try again.
        </FocusMessage>
      )}
      <p className="text-xs text-ink-faint">Pick the bottle size, then tap how full it is — that saves it.</p>

      {items.length === 0 ? (
        <p className={`${card} text-sm text-ink-soft`}>
          Nothing on the shelf yet.{" "}
          <Link href="/cabinet/edit" className="font-semibold text-teal underline underline-offset-2">
            Add what we have
          </Link>{" "}
          first.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(([id, bottle]) => {
            const level = bar!.inventory.get(id) ?? { sizeMl: null, remainingMl: null };
            const left = describeLeft(level);
            const headingId = `level-${id}-name`;
            return (
              <li key={id} id={`level-${id}`} className={`${card} scroll-mt-4`}>
                <form action={setBottleLevel} className="flex flex-col gap-2">
                  <input type="hidden" name="id" value={id} />
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id={headingId} className="text-sm font-bold text-teal-deep">
                      {name(id)}
                      {bottle && <span className="font-normal text-ink-soft"> · {bottle}</span>}
                    </h2>
                    {isLow(level) && (
                      <span className="shrink-0 rounded-full border border-coral/40 px-2 py-0.5 text-[11px] font-semibold text-coral-deep">
                        Running low
                      </span>
                    )}
                  </div>
                  {savedId === id && sp.levels === "saved" && (
                    <FocusMessage role="status" className="rounded-xl border border-teal/30 px-3 py-1.5 text-xs text-teal-deep">
                      Saved {name(id)}.
                    </FocusMessage>
                  )}
                  {savedId === id && sp.levels === "error" && (
                    <FocusMessage role="alert" className="rounded-xl border border-coral/30 px-3 py-1.5 text-xs text-coral-deep">
                      Couldn&apos;t save that. Please try again.
                    </FocusMessage>
                  )}
                  <p className="flex items-center gap-2 text-xs text-ink-soft">
                    <LevelMeter level={level} />
                    {left ?? "Not tracked"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor={`size-${id}`} className="text-xs text-ink-soft">
                      Bottle size
                    </label>
                    <select
                      id={`size-${id}`}
                      name="size"
                      defaultValue={String(level.sizeMl ?? DEFAULT_SIZE)}
                      className="rounded-xl border border-teal bg-card px-2 py-1.5 text-sm text-ink"
                    >
                      {[...new Set([...SIZE_CHOICES, ...(level.sizeMl ? [level.sizeMl] : [])])]
                        .sort((a, b) => a - b)
                        .map((s) => (
                          <option key={s} value={s}>
                            {s >= 1000 ? `${s / 1000} L` : `${s} ml`}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div role="group" aria-label={`How much ${name(id)} is left`} className="flex flex-wrap gap-1.5">
                    {LEVEL_CHOICES.map((c) => (
                      <button
                        key={c.value}
                        type="submit"
                        name="level"
                        value={c.value}
                        className="min-h-8 rounded-full border border-teal/30 bg-card px-3 text-xs font-semibold text-teal-deep hover:bg-sand-deep"
                      >
                        {c.label}
                        {/^[¼½¾]$/.test(c.label) && <span className="sr-only"> full</span>}
                      </button>
                    ))}
                    {level.remainingMl !== null && (
                      <button
                        type="submit"
                        name="level"
                        value="untrack"
                        className="min-h-8 px-2 text-xs font-semibold text-ink-soft underline underline-offset-2"
                      >
                        Stop tracking
                      </button>
                    )}
                  </div>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
