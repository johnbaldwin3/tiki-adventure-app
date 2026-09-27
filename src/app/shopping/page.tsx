import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { PageShell, SectionHeading } from "@/components/page-shell";
import { ShoppingButton, ShoppingStatus } from "@/components/shopping-button";
import { getSignedInUser } from "@/lib/auth/current-taster";
import { summarizeCabinet } from "@/lib/cabinet";
import {
  fetchBar,
  fetchCabinet,
  fetchShoppingList,
  type Cabinet,
} from "@/lib/cabinet-data";
import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { getIngredient } from "@/lib/ingredients";
import { summarizeShopping } from "@/lib/shopping";
import { describeLeft, isLow } from "@/lib/inventory";
import { totalWineSearchUrl, WINEXPRESS } from "@/lib/stores";
import { boughtShoppingItem, removeFromShopping } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Shopping list",
  robots: { index: false },
};

const card = "rounded-2xl bg-card p-4 shadow-sm";
const SUGGESTIONS = 5;

function DrinkLinks({ drinks }: { drinks: CocktailRecord[] }) {
  return (
    <>
      {drinks.map((d, i) => (
        <span key={d.slug}>
          {i > 0 && ", "}
          <Link
            href={`/cocktails/${d.slug}`}
            prefetch={false}
            className="font-semibold text-teal underline-offset-2 hover:underline"
          >
            {d.name}
          </Link>
          {!d.tried && <span className="text-ink-faint"> (new to us)</span>}
        </span>
      ))}
    </>
  );
}

export default async function ShoppingPage({
  searchParams,
}: PageProps<"/shopping">) {
  const sp = await searchParams;
  const user = await getSignedInUser();
  const shell = { eyebrow: "JB & GM only", title: "Shopping list", icon: "🛒" };

  if (!user) {
    return (
      <PageShell
        {...shell}
        intro="What to pick up for our bar, and what each bottle would let us make."
      >
        <p className={`${card} text-sm text-ink-soft`}>
          <Link
            href="/login?next=%2Fshopping"
            className="font-semibold text-teal underline underline-offset-2"
          >
            Sign in
          </Link>{" "}
          to see and update our shopping list.
        </p>
      </PageShell>
    );
  }
  if (!user.taster && !user.lookupFailed) {
    return (
      <PageShell {...shell}>
        <p className={`${card} text-sm text-ink-soft`}>
          You&apos;re signed in as {user.email}, which isn&apos;t linked to a
          taster, so the shopping list isn&apos;t available.
        </p>
      </PageShell>
    );
  }

  let cabinet: Cabinet | null = null;
  let list: Set<string> | null = null;
  let records: CocktailRecord[] | null = null;
  if (user.taster) {
    try {
      [cabinet, list, records] = await Promise.all([
        fetchCabinet(),
        fetchShoppingList(),
        fetchCocktailRecords(),
      ]);
    } catch (err) {
      unstable_rethrow(err);
      console.error("shopping: failed to load", err);
    }
  }
  if (!cabinet || !list || !records) {
    return (
      <PageShell {...shell}>
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load the shopping list right now. Please try refreshing
          the page.
        </p>
      </PageShell>
    );
  }

  const have = new Set(cabinet.keys());
  const inventory = (
    await fetchBar().catch((err) => {
      unstable_rethrow(err);
      console.error("shopping: failed to load levels", err);
      return null;
    })
  )?.inventory;
  const low = new Set([...(inventory ?? new Map()).entries()].filter(([, l]) => isLow(l)).map(([id]) => id));
  const summary = summarizeShopping(records, have, list, low);
  const suggestions = summarizeCabinet(records, have)
    .buyNext.filter((b) => !list!.has(b.ingredientId))
    .slice(0, SUGGESTIONS);
  const name = (id: string) => getIngredient(id)?.name ?? id;
  const n = summary.items.length;

  return (
    <PageShell
      {...shell}
      eyebrow="JB & GM's home bar"
      back={{ href: "/cabinet", label: "Our bar" }}
      intro={
        n === 0
          ? "Nothing to buy yet."
          : summary.unlocks.length === 0
            ? `${n} to buy`
            : `${n} to buy · would let us make ${summary.unlocks.length} more ${summary.unlocks.length === 1 ? "drink" : "drinks"}`
      }
    >
      <ShoppingStatus status={sp.shopping} here="/shopping" />

      <section aria-labelledby="list-heading" className="flex flex-col gap-2">
        <SectionHeading id="list-heading">To buy ({n})</SectionHeading>
        {n === 0 ? (
          <p className={`${card} text-sm italic text-ink-faint`}>
            The list is empty. Add ingredients from the ideas below, from{" "}
            <Link
              href="/cabinet"
              className="font-semibold not-italic text-teal underline underline-offset-2"
            >
              our bar
            </Link>
            , a recipe card, or any ingredient page.
          </p>
        ) : (
          <ul aria-label="To buy" className="flex flex-col gap-3">
            {summary.items.map((item) => {
              const ingredient = getIngredient(item.ingredientId)!;
              return (
                <li key={item.ingredientId} className={card}>
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/ingredients/${item.ingredientId}`}
                      prefetch={false}
                      className="text-base font-bold text-teal-deep underline-offset-2 hover:underline"
                    >
                      {ingredient.name}
                    </Link>
                    <span className="shrink-0 text-xs text-ink-soft">
                      Used in {item.usedBy}{" "}
                      {item.usedBy === 1 ? "drink" : "drinks"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {item.restock ? (
                      <>
                        Restock — we&apos;re running low
                        {inventory?.get(item.ingredientId) && describeLeft(inventory.get(item.ingredientId)!)
                          ? ` (${describeLeft(inventory.get(item.ingredientId)!)})`
                          : ""}
                        .
                      </>
                    ) : item.completes.length > 0 ? (
                      <>
                        With the rest of the list, completes:{" "}
                        <DrinkLinks drinks={item.completes} />
                      </>
                    ) : (
                      "Not enough for any drink yet — they also need things that aren't on the list."
                    )}
                  </p>
                  {ingredient.brands.length > 0 && (
                    <ul
                      aria-label={`Bottles to look for: ${ingredient.name}`}
                      className="mt-2 flex flex-wrap gap-1.5"
                    >
                      {ingredient.brands.map((b) => (
                        <li key={b}>
                          <a
                            href={totalWineSearchUrl(b)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Search Total Wine for ${b} (opens in a new tab)`}
                            className="inline-block rounded-full border border-teal/30 px-2.5 py-1 text-xs font-semibold text-teal-deep hover:bg-sand-deep"
                          >
                            {b} <span aria-hidden="true">↗</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={boughtShoppingItem}>
                      <input
                        type="hidden"
                        name="id"
                        value={item.ingredientId}
                      />
                      <input type="hidden" name="returnTo" value="/shopping" />
                      <button
                        type="submit"
                        aria-label={`Got it — add to our bar: ${ingredient.name}`}
                        className="rounded-full bg-teal-deep px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                      >
                        <span aria-hidden="true">✓ </span>Got it — add to our
                        bar
                      </button>
                    </form>
                    <form action={removeFromShopping}>
                      <input
                        type="hidden"
                        name="id"
                        value={item.ingredientId}
                      />
                      <input type="hidden" name="returnTo" value="/shopping" />
                      <button
                        type="submit"
                        aria-label={`Remove: ${ingredient.name}`}
                        className="px-2 py-1.5 text-xs font-semibold text-ink-soft underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {n > 0 && (
        <section
          aria-labelledby="where-heading"
          className={`${card} text-sm text-ink-soft`}
        >
          <h2
            id="where-heading"
            className="text-sm font-bold uppercase tracking-wide text-ink-soft"
          >
            Where to buy
          </h2>
          <p className="mt-2">
            The bottle links search Total Wine, which shows stock for the store
            you&apos;ve picked on their site. {WINEXPRESS.name} has no online
            catalog — call{" "}
            <a
              href={WINEXPRESS.phoneHref}
              className="font-semibold text-teal underline underline-offset-2"
            >
              {WINEXPRESS.phoneDisplay}
            </a>{" "}
            ({WINEXPRESS.address}).
          </p>
        </section>
      )}

      {suggestions.length > 0 && (
        <section
          aria-labelledby="ideas-heading"
          className="flex flex-col gap-2"
        >
          <SectionHeading id="ideas-heading">Ideas</SectionHeading>
          <p className="text-xs text-ink-faint">
            Each of these alone would complete drinks, given what&apos;s in our
            bar.
          </p>
          <ul className="flex flex-col gap-2">
            {suggestions.map((b) => (
              <li key={b.ingredientId} className={card}>
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/ingredients/${b.ingredientId}`}
                    prefetch={false}
                    className="text-sm font-bold text-teal-deep underline-offset-2 hover:underline"
                  >
                    {name(b.ingredientId)}
                  </Link>
                  <span className="shrink-0 text-xs font-semibold text-ink-soft">
                    +{b.unlocks.length}{" "}
                    {b.unlocks.length === 1 ? "drink" : "drinks"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  <DrinkLinks drinks={b.unlocks} />
                </p>
                <div className="mt-2">
                  <ShoppingButton
                    ids={[b.ingredientId]}
                    onList={false}
                    returnTo="/shopping"
                    itemName={name(b.ingredientId)}
                    label="Add"
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageShell>
  );
}
