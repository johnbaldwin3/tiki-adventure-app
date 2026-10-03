import Form from "next/form";
import { RecipeCredits } from "@/components/recipe-credits";
import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { IngredientFilter } from "@/components/ingredient-filter";
import { SearchBox } from "@/components/search-box";
import { StyleFilter } from "@/components/style-filter";
import { matchesStyles, parseStyleFilter } from "@/lib/styles";
import { SuggestionCard } from "@/components/suggestion-card";
import { fetchBar, fetchCabinet } from "@/lib/cabinet-data";
import { isLow } from "@/lib/inventory";
import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { APP_NAME, collectionCounts, inCollection, parseCollection, TIKI_SLUG, type Collection } from "@/lib/collections";
import { fetchCollections } from "@/lib/collections-data";
import { getIngredient, lineIds } from "@/lib/ingredients";
import {
  filterCocktails,
  LIST_FILTERS,
  listHref,
  matchesIngredients,
  matchesSearch,
  parseSearch,
  searchText,
  parseIngredientFilter,
  parseIngredientMatch,
  parseListFilter,
  type ListFilter,
} from "@/lib/list";
import { suggestNext } from "@/lib/suggest";
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
  const recipeDeleted = sp.recipe === "deleted";
  const ingredientIds = parseIngredientFilter(sp.ing, sp.add, (id) => !!getIngredient(id));
  const match = parseIngredientMatch(sp.match);
  const q = parseSearch(sp.q);
  const style = parseStyleFilter(sp.style);
  const collections: Collection[] = await fetchCollections()
    .then((r) => r.collections)
    .catch((err) => {
      unstable_rethrow(err);
      console.error("home: failed to load collections", err);
      return [];
    });
  const collection = parseCollection(sp.c, collections);
  const cSlug = collection?.slug ?? null;
  // The picker form submits ?add=<id>; fold it into a clean, shareable URL.
  // Tidy the search too: an empty box submits ?q=, and stray spaces or an
  // over-long query shouldn't make a second URL for the same view.
  const badCollection = sp.c !== undefined && sp.c !== cSlug && collections.length > 0;
  const badStyle = sp.style !== undefined && (Array.isArray(sp.style) || style.length === 0 || sp.style !== style.join(","));
  if (sp.add !== undefined || (sp.q !== undefined && sp.q !== q) || badCollection || badStyle) {
    redirect(listHref({ c: cSlug, show: filter, ing: ingredientIds, match, q, style }));
  }
  // Only for signed-in tasters (RLS); null otherwise. Started now, used below.
  const cabinetPromise = fetchCabinet().catch((err) => {
    unstable_rethrow(err);
    console.error("home: failed to load cabinet", err);
    return null;
  });

  let allRecords: CocktailRecord[];
  let loadError: string | null = null;
  try {
    allRecords = await fetchCocktailRecords();
  } catch (err) {
    console.error("home: failed to load the tasting log", err);
    loadError =
      err instanceof Error ? err.message : "Failed to load the tasting log.";
    allRecords = [];
  }
  const perCollection = collectionCounts(allRecords);
  // Everything below is scoped to the chosen collection (or all drinks).
  const records = inCollection(allRecords, collection);
  const isTiki = cSlug === TIKI_SLUG;

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
      new Set(lineIds(r.ingredientTexts, r.ingredientIds).filter((id): id is string => !!id)),
    ])
  );
  const beforeStyle = listed.filter(
    (c) =>
      matchesIngredients(idsBySlug.get(c.slug) ?? new Set(), ingredientIds, match) &&
      (q === "" ||
      matchesSearch(
        searchText({
          name: c.name,
          primarySpirits: c.primarySpirits,
          ingredients: [
            ...c.ingredientTexts,
            ...[...(idsBySlug.get(c.slug) ?? [])].map((id) => getIngredient(id)?.name ?? ""),
          ],
        }),
        q
      ))
  );
  // Style tags: counts are within the other filters, so each chip says what adding it would leave.
  const ingredientMatched = beforeStyle.filter((c) => matchesStyles(c.styles, style));
  const visible = filterCocktails(ingredientMatched, filter);
  const styleCounts: Record<string, number> = {};
  for (const c of visible) for (const t of c.styles ?? []) styleCounts[t] = (styleCounts[t] ?? 0) + 1;
  const matchedTried = ingredientMatched.filter((c) => c.tried).length;
  const counts: Record<ListFilter, number> = {
    all: ingredientMatched.length,
    tasted: matchedTried,
    untasted: ingredientMatched.length - matchedTried,
  };
  const usageCounts: Record<string, number> = {};
  for (const ids of idsBySlug.values()) for (const id of ids) usageCounts[id] = (usageCounts[id] ?? 0) + 1;

  const cabinet = await cabinetPromise;
  // Tasters only (same cached read as the cabinet): bottles running low.
  const inventory = cabinet
    ? ((
        await fetchBar().catch((err) => {
          unstable_rethrow(err);
          console.error("home: failed to load levels", err);
          return null;
        })
      )?.inventory ?? null)
    : null;
  const lowIds = inventory
    ? [...inventory.entries()]
        .filter(([, l]) => isLow(l))
        .map(([id]) => id)
        .sort((a, b) => (getIngredient(a)?.name ?? a).localeCompare(getIngredient(b)?.name ?? b))
    : [];
  const tryNext = loadError
    ? []
    : suggestNext(listed, { have: cabinet ? new Set(cabinet.keys()) : null, limit: 3 });

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
      {isTiki ? (
        <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
          <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20">
            🌴
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-8 -left-4 text-7xl opacity-10">
            🌺
          </span>
          <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            {APP_NAME} · Tiki collection
          </p>
          <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">🍹 Adventures in Tiki</h1>
          <p className="relative mt-2 max-w-xs text-sm text-white/90">
            JB &amp; GM&apos;s tasting log for the tiki &amp; tropical cocktail canon.
          </p>
        </header>
      ) : (
        <header className="bar-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
          <span aria-hidden="true" className="pointer-events-none absolute -right-3 -top-5 text-8xl opacity-15">
            🍸
          </span>
          <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            JB &amp; GM&apos;s home bar
          </p>
          <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">{APP_NAME}</h1>
          <p className="relative mt-2 max-w-xs text-sm text-white/90">
            {collection?.description ?? "Our cocktails, our bar and our tasting log — tiki, classics and more."}
          </p>
        </header>
      )}

      {collections.length > 0 && (
        <nav aria-label="Collections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[null, ...collections].map((col) => {
            const active = (col?.slug ?? null) === cSlug;
            const count = col ? (perCollection.get(col.slug) ?? 0) : allRecords.length;
            return (
              <Link
                key={col?.slug ?? "all"}
                href={listHref({ c: col?.slug ?? null, show: filter, ing: ingredientIds, match, q, style })}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${
                  active ? "bg-ink text-white" : "border border-teal/20 bg-card text-teal-deep hover:bg-sand-deep"
                }`}
              >
                {col?.name ?? "All drinks"} <span className={active ? "text-white/80" : "text-ink-faint"}>{count}</span>
              </Link>
            );
          })}

        </nav>
      )}

      {recipeDeleted && (
        <p role="status" className="rounded-2xl border border-teal/30 bg-card p-3 text-sm text-teal-deep shadow-sm">
          The recipe was deleted.
        </p>
      )}

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
            href="/cabinet"
            className="rounded-full px-2 py-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
          >
            Our bar <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/shopping"
            className="rounded-full px-2 py-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
          >
            Shopping list <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/next"
            className="rounded-full px-2 py-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
          >
            What to try next <span aria-hidden="true">→</span>
          </Link>
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

      {lowIds.length > 0 && (
        <p className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-ink shadow-sm">
          <span className="font-semibold text-coral-deep">Running low:</span>{" "}
          {lowIds.map((id) => getIngredient(id)?.name ?? id).join(", ")}.{" "}
          <Link href="/cabinet#low" className="font-semibold text-teal underline underline-offset-2">
            See our bar
          </Link>
        </p>
      )}

      {tryNext.length > 0 && (
        <section aria-labelledby="try-next-heading" className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 id="try-next-heading" className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              Try next
            </h2>
            <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
            <Link href="/next" className="shrink-0 text-xs font-semibold text-teal underline-offset-2 hover:underline">
              More ideas to try <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {tryNext.map((s) => (
              <li key={s.drink.slug}>
                <SuggestionCard s={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="cocktail-list-heading" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2
            id="cocktail-list-heading"
            className="text-sm font-bold uppercase tracking-wide text-ink-soft"
          >
            {collection ? collection.name : "All drinks"}
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
          {/* Only tasters can add; the cabinet loads only for them. */}
          {cabinet && (
            <Link
              href="/collections"
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-teal underline-offset-2 hover:underline"
            >
              Collections
            </Link>
          )}
          {cabinet && (
            <Link
              href={cSlug ? `/cocktails/new?c=${encodeURIComponent(cSlug)}` : "/cocktails/new"}
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-teal underline-offset-2 hover:underline"
            >
              + Add a recipe
            </Link>
          )}
        </div>

        <Form action="/" scroll={false} role="search" className="flex items-end gap-2">
          {/* First, so the URL comes out in listHref's order (?c=…&q=…). */}
          {cSlug && <input type="hidden" name="c" value={cSlug} />}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="search" className="text-xs font-semibold text-ink-soft">
              Search by name, spirit or ingredient
            </label>
            <SearchBox q={q} />
          </div>
          {/* After the search box, so the URL comes out in listHref's order (?q=…&show=…). */}
          {filter !== "all" && <input type="hidden" name="show" value={filter} />}
          {ingredientIds.length > 0 && <input type="hidden" name="ing" value={ingredientIds.join(",")} />}
          {match === "any" && <input type="hidden" name="match" value="any" />}
          {style.length > 0 && <input type="hidden" name="style" value={style.join(",")} />}
          <button
            type="submit"
            className="shrink-0 rounded-full bg-teal-deep px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          >
            Search
          </button>
        </Form>
        <div className="-mt-1 flex min-h-4 items-center justify-between text-xs">
          {/* The one results count (search and ingredients), always rendered so screen readers announce changes. */}
          <p role="status" className="text-ink-soft">
            {q !== "" || ingredientIds.length > 0 || style.length > 0
              ? `${visible.length} ${visible.length === 1 ? "drink matches" : "drinks match"}${q !== "" ? ` “${q}”` : ""}${
                  ingredientIds.length > 0 ? (q !== "" ? " with those ingredients" : "") : ""
                }${style.length > 0 && (q !== "" || ingredientIds.length > 0) ? " and styles" : ""}${filter === "tasted" ? " (tasted)" : filter === "untasted" ? " (not tried yet)" : ""}`
              : ""}
          </p>
          {q !== "" && (
            <Link
              href={listHref({ c: cSlug, show: filter, ing: ingredientIds, match, style })}
              scroll={false}
              className="font-semibold text-teal underline-offset-2 hover:underline"
            >
              Clear search
            </Link>
          )}
        </div>

        <nav aria-label="Filter cocktails" className="flex gap-2">
          {LIST_FILTERS.map((f) => {
            const active = f.value === filter;
            return (
              <Link
                key={f.value}
                href={listHref({ c: cSlug, show: f.value, ing: ingredientIds, match, q, style })}
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

        <StyleFilter c={cSlug} q={q} show={filter} ing={ingredientIds} match={match} selected={style} counts={styleCounts} />

        <IngredientFilter
          q={q}
          c={cSlug}
          style={style}
          showCount={false}
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
            {style.length > 0
              ? `No drinks here match all of those styles${q !== "" ? ` and “${q}”` : ""}${
                  ingredientIds.length > 0 ? " with those ingredients" : ""
                }${filter === "tasted" ? " among the tasted ones" : filter === "untasted" ? " among the ones not tried yet" : ""}. Try removing one.`
              : q !== "" && ingredientIds.length > 0
              ? `No drinks match “${q}” with those ingredients${filter === "tasted" ? " among the tasted ones" : filter === "untasted" ? " among the ones not tried yet" : ""}.`
              : q !== ""
              ? `No drinks match “${q}”${filter === "tasted" ? " among the tasted ones" : filter === "untasted" ? " among the ones not tried yet" : ""}.`
              : ingredientIds.length > 0
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
            const circle = showOurRank ? (c.rank ?? "–") : (c.diffordsRank ?? (c.source === "iba" ? "◆" : "★"));
            const circleLabel = showOurRank
              ? c.rank
                ? `Our rank ${c.rank}`
                : "Not yet rated"
              : c.diffordsRank !== null
                ? `Difford's rank ${c.diffordsRank}`
                : c.source === "iba"
                  ? "IBA official cocktail"
                  : "Our recipe";
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
                    <span className="text-sm font-semibold text-ink">
                      {c.name}
                      {c.isGuess && (
                        <span className="ml-1.5 inline-block rounded-full bg-sand-deep px-1.5 py-px align-middle text-[0.65rem] font-bold uppercase tracking-wide text-ink">
                          Best guess
                        </span>
                      )}
                    </span>
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

      <RecipeCredits />
    </main>
  );
}
