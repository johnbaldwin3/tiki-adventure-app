import { fetchCocktailRecords, type CocktailRecord } from "@/lib/cocktails";
import { rankCocktails, summarizeProgress } from "@/lib/tasting";

// This page reads live from Supabase on every request rather than being
// statically generated or ISR-cached. The tasting log is small (100 rows)
// and cheap to query, and once Phase 7 auth lands, JB/GM will be able to
// add/edit tastings themselves -- always-fresh reads avoid a stale cache
// showing an old rating after someone just entered one. Revisit this if/when
// traffic or DB load ever makes that trade-off worth reconsidering.
export const dynamic = "force-dynamic";

export default async function Page() {
  let records: CocktailRecord[];
  let loadError: string | null = null;
  try {
    records = await fetchCocktailRecords();
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Failed to load the tasting log.";
    records = [];
  }

  const ranked = rankCocktails(records);
  const summary = summarizeProgress(records);
  const rankByName = new Map(ranked.map((r) => [r.name, r]));

  const triedSorted = records
    .filter((c) => c.tried)
    .sort((a, b) => {
      const rankA = rankByName.get(a.name)?.rank ?? Infinity;
      const rankB = rankByName.get(b.name)?.rank ?? Infinity;
      return rankA - rankB;
    });

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
    { icon: "🥃", label: "JB Average", value: summary.jbAverage ?? "—" },
    { icon: "🍸", label: "GM Average", value: summary.gmAverage ?? "—" },
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

      {loadError && (
        <p
          role="alert"
          className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm"
        >
          Couldn&apos;t load the tasting log right now. Please try refreshing
          the page.
        </p>
      )}

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

      <section aria-label="Tasted cocktails" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            Tasted so far
          </h2>
          <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
        </div>
        <ul className="flex flex-col gap-2">
          {triedSorted.map((c) => {
            const r = rankByName.get(c.name);
            return (
              <li
                key={c.name}
                className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-coral-deep text-xs font-bold text-white"
                >
                  {r?.rank ?? "–"}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {c.name}
                  </span>
                  <span className="text-xs text-ink-faint">
                    {c.primarySpirits.join(", ")}
                  </span>
                </div>
                <span className="rounded-full bg-teal-deep px-2.5 py-1 text-xs font-bold text-white">
                  {r?.avgRating ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="pt-2 text-center text-xs text-ink-faint">
        Recipes adapted from{" "}
        <a
          href="https://www.diffordsguide.com/cocktails/directory/styles/tiki-tropical"
          className="font-semibold text-teal underline underline-offset-2"
        >
          Difford&apos;s Guide
        </a>
        .
      </p>
    </main>
  );
}
