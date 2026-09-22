import cocktails from "../../seed-data/cocktails.json";
import { rankCocktails, summarizeProgress } from "@/lib/tasting";

interface SeedCocktail {
  name: string;
  tried: boolean;
  jbRating: number | null;
  gmRating: number | null;
  primarySpirits: string[];
  diffordsGuideUrl: string;
}

const records = cocktails as SeedCocktail[];

export default function Page() {
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:max-w-lg">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-teal-800">
          🍹 Adventures in Tiki
        </h1>
        <p className="text-sm text-neutral-600">
          Tasting log for Difford&apos;s Guide Top 100 Tiki &amp; Tropical
          Cocktails.
        </p>
      </header>

      <section
        aria-label="Progress summary"
        className="grid grid-cols-2 gap-2"
      >
        <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Tasted
          </p>
          <p className="text-lg font-semibold text-teal-900">
            {summary.triedCount} / {summary.total}
          </p>
        </div>
        <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Progress
          </p>
          <p className="text-lg font-semibold text-teal-900">
            {Math.round(summary.fraction * 100)}%
          </p>
        </div>
        <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            JB Average
          </p>
          <p className="text-lg font-semibold text-teal-900">
            {summary.jbAverage ?? "—"}
          </p>
        </div>
        <div className="rounded-lg border border-teal-100 bg-teal-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            GM Average
          </p>
          <p className="text-lg font-semibold text-teal-900">
            {summary.gmAverage ?? "—"}
          </p>
        </div>
      </section>

      <section aria-label="Tasted cocktails" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-700">
          Tasted so far
        </h2>
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {triedSorted.map((c) => {
            const r = rankByName.get(c.name);
            return (
              <li key={c.name} className="flex items-center gap-3 p-3">
                <span className="w-6 shrink-0 text-center text-xs font-semibold text-neutral-400">
                  {r?.rank ?? "–"}
                </span>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium text-neutral-900">
                    {c.name}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {c.primarySpirits.join(", ")}
                  </span>
                </div>
                <span className="text-sm font-semibold text-teal-800">
                  {r?.avgRating ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="pb-4 text-center text-xs text-neutral-400">
        Recipes adapted from{" "}
        <a
          href="https://www.diffordsguide.com/cocktails/directory/styles/tiki-tropical"
          className="underline"
        >
          Difford&apos;s Guide
        </a>
        .
      </p>
    </main>
  );
}
