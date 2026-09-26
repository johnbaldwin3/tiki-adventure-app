import Link from "next/link";
import { redirect } from "next/navigation";
import { IngredientFilter } from "@/components/ingredient-filter";
import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { getIngredient, resolveIngredient } from "@/lib/ingredients";
import {
  filterCocktails,
  LIST_FILTERS,
  listHref,
  matchesIngredients,
  parseIngredientFilter,
  parseIngredientMatch,
  parseListFilter,
  type ListFilter,
} from "@/lib/list";
import { rankCocktails, summarizeProgress } from "@/lib/tasting";

// This page reads live from Supabase on every request rather than being
// statically generated or ISR-cached. The tasting log is small (100 rows)
// and cheap to query, and JB/GM edit tastings from the recipe cards --
// always-fresh reads avoid a stale cache showing an old rating right after
// someone saved a new one. Revisit if traffic or DB load ever makes that
// trade-off worth reconsidering.
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const filter = parseListFilter(sp.show);
  const passwordUpdated = sp.password === "updated";
  const ingredientIds = parseIngredientFilter(sp.ing, sp.add, (id) => !!getIngredient(id));
  const match = parseIngredientMatch(sp.match);
  // The picker form submits ?add=<id>; fold it into a clean, shareable URL.
  if (sp.add !== undefined) redirect(listHref({ show: filter, ing: ingredientIds, match }));

  let records: CocktailRecord[];
  let loadError: string | null = null;
  try {
    records = await fetchCocktailRecords();
  } catch (err) {
    console.error("home: failed to load the tasting log", err);
    loadError =
      err instanceof Error ? err.message : "Failed to load the tasting log.";
    records = [];
  }

  const ranked = rankCocktails(records);
  const summary = summarizeProgress(records);
  const rankByName = new Map(ranked.map((r) => [r.name, r]));

  const listed = records.map((c) => ({
    ...c,
    avgRating: rankByName.get(c.name)?.avgRating ?? null,
    rank: rankByName.get(c.name)?.rank ?? null,
  }));
  // Catalog ingredient ids per cocktail, for the ingredient filter and its counts.
  const idsBySlug = new Map(
    records.map((r) => [
      r.slug,
      new Set(r.ingredientTexts.map((t) => resolveIngredient(t)?.ingredient.id).filter((id): id is string => !!id)),
    ])
  );
  const ingredientMatched = listed.filter((c) =>
    matchesIngredients(idsBySlug.get(c.slug) ?? new Set(), ingredientIds, match)
  );
  const visible = filterCocktails(ingredientMatched, filter);
  const matchedTried = ingredientMatched.filter((c) => c.tried).length;
  const counts: Record<ListFilter, number> = {
    all: ingredientMatched.length,
    tasted: matchedTried,
    untasted: ingredientMatched.length - matchedTried,
  };
  const usageCounts: Record<string, number> = {};
  for (const ids of idsBySlug.values()) for (const id of ids) usageCounts[id] = (usageCounts[id] ?? 0) + 1;

  const kpis = [
    {
      icon: "🍹",
      label: "Tasted",
      value: `${summary.triedCount} / ${summary.total}`,
    },
    {
      icon: "🌺",
      label: "Progress",
      value: `${Math.round(summary.fraction * 100)}%`,
    },
    { icon: "🥃", label: "John's average", value: summary.jbAverage ?? "—" },
    { icon: "🍸", label: "Genny's average", value: summary.gmAverage ?? "—" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-8 pt-6 sm:max-w-lg">
      <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20"
        >
          🌴
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -left-4 text-7xl opacity-10"
        >
          🌺
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          Difford&apos;s Guide Top 100
        </p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">
          🍹 Adventures in Tiki
        </h1>
        <p className="relative mt-2 max-w-xs text-sm text-white/90">
          JB &amp; GM&apos;s tasting log for the tiki &amp; tropical cocktail
          canon.
        </p>
      </header>

      {passwordUpdated && (
        <p role="status" className="rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm">
          Your password has been updated.
        </p>
      )}

      {loadError && (
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load the tasting log right now. Please try refreshing
          the page.
        </p>
      )}

      {!loadError && (
        <>
      <div className="flex flex-col gap-2">
        <section
          aria-label="Progress summary"
          className="grid grid-cols-2 gap-3"
        >
          {kpis.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-teal/15 bg-sand-deep p-3 shadow-sm"
            >
              <p aria-hidden="true" className="text-lg leading-none">
                {item.icon}
              </p>
              <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-teal">
                {item.label}
              </p>
              <p className="text-xl font-bold text-teal-deep">{item.value}</p>
            </div>
          ))}
        </section>
        <div className="flex flex-wrap justify-end gap-x-2">
          <Link
            href="/ingredients"
            className="rounded-full px-2 py-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
          >
            Browse ingredients <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/stats"
            className="rounded-full px-2 py-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
          >
            See all our stats <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <section aria-labelledby="cocktail-list-heading" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2
            id="cocktail-list-heading"
            className="text-sm font-bold uppercase tracking-wide text-ink-soft"
          >
            The Top 100
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
        </div>

        <nav aria-label="Filter cocktails" className="flex gap-2">
          {LIST_FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Link
                key={f.value}
                href={listHref({ show: f.value, ing: ingredientIds, match })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-full px-3 py-2 text-center text-sm font-semibold shadow-sm transition-colors ${
                  active
                    ? "bg-teal-deep text-white"
                    : "border border-teal/20 bg-card text-teal-deep hover:bg-sand-deep"
                }`}
              >
                {f.label} <span className={active ? "text-white/80" : "text-ink-faint"}>{counts[f.value]}</span>
              </Link>
            );
          })}
        </nav>

        <IngredientFilter
          show={filter}
          selected={ingredientIds}
          match={match}
          usageCounts={usageCounts}
          resultCount={visible.length}
        />

        {filter === "tasted" && (
          <p className="text-xs text-ink-faint">
            Ranked by JB &amp; GM&apos;s average rating.
          </p>
        )}

        {visible.length === 0 && !loadError && (
          <p className="rounded-xl bg-card p-4 text-center text-sm text-ink-soft shadow-sm">
            {ingredientIds.length > 0
              ? `${
                  ingredientIds.length === 1
                    ? "No drinks here use that"
                    : match === "all"
                      ? "No drinks here use all of those. Try “Any of these”, or remove one"
                      : "No drinks here use any of those"
                }${filter === "tasted" ? " among the tasted ones" : filter === "untasted" ? " among the ones not tried yet" : ""}.`
              : filter === "untasted"
                ? "You've tasted them all! 🎉"
                : "Nothing here yet."}
          </p>
        )}

        <ul aria-label="Cocktails" className="flex flex-col gap-2">
          {visible.map((c) => {
            // The number in the circle follows the current ordering: our
            // rank on the Tasted view (sorted by rating), Difford's rank
            // everywhere else (sorted by Difford's list).
            const showOurRank = filter === "tasted";
            const circle = showOurRank ? (c.rank ?? "–") : c.diffordsRank;
            const circleLabel = showOurRank
              ? c.rank
                ? `Our rank ${c.rank}`
                : "Not yet rated"
              : `Difford's rank ${c.diffordsRank}`;
            return (
              <li key={c.slug}>
                <Link
                  href={`/cocktails/${c.slug}`}
                  // Card pages are force-dynamic and query Supabase (incl. in
                  // generateMetadata), so prefetching every visible row would
                  // fire ~3 queries per row. loading.tsx gives instant
                  // feedback on tap instead.
                  prefetch={false}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      showOurRank
                        ? "bg-coral-deep text-white"
                        : "border border-teal/30 bg-sand text-teal-deep"
                    }`}
                  >
                    <span aria-hidden="true">{circle}</span>
                    <span className="sr-only">{circleLabel}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold text-ink">{c.name}</span>
                    <span className="truncate text-xs text-ink-faint">
                      {c.primarySpirits.join(", ")}
                    </span>
                  </span>
                  {c.avgRating !== null ? (
                    <span className="rounded-full bg-teal-deep px-2.5 py-1 text-xs font-bold text-white">
                      <span className="sr-only">Average rating </span>
                      {c.avgRating}
                    </span>
                  ) : c.tried ? (
                    <span className="rounded-full border border-teal/30 px-2.5 py-1 text-xs font-semibold text-teal-deep">
                      Tried
                    </span>
                  ) : null}
                  <span aria-hidden="true" className="text-lg leading-none text-ink-faint">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
        </>
      )}

      <p className="pt-2 text-center text-xs text-ink-faint">
        Recipes adapted from{" "}
        <a
          href="https://www.diffordsguide.com/cocktails/directory/styles/tiki-tropical"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-teal underline underline-offset-2"
        >
          Difford&apos;s Guide<span className="sr-only"> (opens in a new tab)</span>
        </a>
        .
      </p>
    </main>
  );
}
