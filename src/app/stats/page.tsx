import type { Metadata } from "next";
import Link from "next/link";
import { fetchCocktailRecords } from "@/lib/cocktails";
import { computeDashboardStats, type DashboardStats, type TasterStats } from "@/lib/stats";

// Same always-fresh reasoning as the home page (src/app/page.tsx).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our stats · Adventures in Tiki",
};

const TASTERS = [
  { key: "jb" as const, initials: "JB", name: "John", color: "bg-chart-jb" },
  { key: "gm" as const, initials: "GM", name: "Genny", color: "bg-chart-gm" },
];

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="text-sm font-bold uppercase tracking-wide text-ink-soft">
        {children}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-teal/20" />
    </div>
  );
}

/** A meter: teal fill on a lighter step of the same ramp. */
function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-valuetext={`${value} of ${total}`}
      className="h-2.5 w-full overflow-hidden rounded-full bg-chart-track"
    >
      {/* teal-deep on the teal-100 track is ~7:1; chart-jb stays reserved for John's data. */}
      <div className="h-full rounded-full bg-teal-deep" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex gap-4 text-xs font-semibold text-ink-soft" aria-label="Legend">
      {TASTERS.map((t) => (
        <li key={t.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${t.color}`} />
          {t.name} ({t.initials})
        </li>
      ))}
    </ul>
  );
}

function TasterTile({ initials, name, stats }: { initials: string; name: string; stats: TasterStats }) {
  return (
    <div className="rounded-2xl border border-teal/15 bg-sand-deep p-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-teal">
        {name}&apos;s average
      </p>
      <p className="text-2xl font-bold text-teal-deep">{stats.average ?? "—"}</p>
      <p className="text-xs text-ink-soft">
        {stats.ratedCount} rated
        <span className="sr-only"> by {initials}</span>
      </p>
      {stats.highest && (
        <p className="mt-2 text-xs text-ink-soft">
          Favorite:{" "}
          <Link href={`/cocktails/${stats.highest.slug}`} prefetch={false} className="font-semibold text-teal underline-offset-2 hover:underline">
            {stats.highest.name}
          </Link>{" "}
          ({stats.highest.rating})
        </p>
      )}
      {stats.lowest && stats.lowest.slug !== stats.highest?.slug && (
        <p className="mt-1 text-xs text-ink-soft">
          Lowest:{" "}
          <Link href={`/cocktails/${stats.lowest.slug}`} prefetch={false} className="font-semibold text-teal underline-offset-2 hover:underline">
            {stats.lowest.name}
          </Link>{" "}
          ({stats.lowest.rating})
        </p>
      )}
    </div>
  );
}

/** Grouped columns: one pair (JB, GM) per rating bin. Counts labeled on the caps. */
function RatingSpread({ histogram }: { histogram: DashboardStats["histogram"] }) {
  const max = Math.max(1, ...histogram.flatMap((b) => [b.jb, b.gm]));
  const PLOT_H = 128; // px
  return (
    <figure className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <figcaption className="flex flex-col gap-2">
        <span className="text-sm text-ink-soft">How many cocktails each of us rated in each range.</span>
        <Legend />
      </figcaption>
      {/* Visual chart is one labelled image for screen readers; the exact
          counts are also in the table below. */}
      <div
        role="img"
        aria-label={TASTERS.map(
          (t) => `${t.name}: ${histogram.map((b) => `${b[t.key]} rated ${b.label}`).join(", ")}`
        ).join(". ")}
        className="relative"
      >
        {/* recessive hairline baseline */}
        <div className="flex items-end justify-between gap-2 border-b border-chart-grid" style={{ height: PLOT_H + 18 }}>
          {histogram.map((b) => (
            <div key={b.label} className="flex flex-1 items-end justify-center gap-0.5">
              {TASTERS.map((t) => {
                const count = b[t.key];
                const h = Math.round((count / max) * PLOT_H);
                return (
                  <div key={t.key} className="flex w-full max-w-6 flex-col items-center justify-end">
                    <span className="mb-0.5 text-[11px] font-semibold text-ink-soft">
                      {count > 0 ? count : ""}
                    </span>
                    <div
                      className={`w-full rounded-t ${t.color}`}
                      style={{ height: count > 0 ? Math.max(h, 3) : 0 }}
                      title={`${t.name}: ${count} rated ${b.label}`}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between gap-2">
          {histogram.map((b) => (
            <span key={b.label} className="flex-1 text-center text-[11px] text-ink-faint">
              {b.label}
            </span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-teal">Show as table</summary>
        <table className="mt-2 w-full text-left text-sm tabular-nums">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-ink-soft">
              <th scope="col" className="py-1 font-semibold">Rating</th>
              <th scope="col" className="py-1 font-semibold">John</th>
              <th scope="col" className="py-1 font-semibold">Genny</th>
            </tr>
          </thead>
          <tbody>
            {histogram.map((b) => (
              <tr key={b.label} className="border-t border-chart-grid">
                <th scope="row" className="py-1 font-normal text-ink">{b.label}</th>
                <td className="py-1 text-ink">{b.jb}</td>
                <td className="py-1 text-ink">{b.gm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Dumbbells: JB and GM dots on a shared rating scale, joined by a line. */
function Disagreements({ items }: { items: DashboardStats["disagreements"] }) {
  const lo = Math.max(0, Math.floor(Math.min(...items.flatMap((d) => [d.jb, d.gm]))) - 1);
  const hi = 10;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(
    (t) => hi - lo <= 5 || t % 2 === 0
  );
  return (
    <figure className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <figcaption className="flex flex-col gap-2">
        <span className="text-sm text-ink-soft">Cocktails we both rated, biggest gap first.</span>
        <Legend />
      </figcaption>
      <ul aria-label="Cocktails we disagree on" className="flex flex-col gap-4">
        {items.map((d) => {
          const [left, right] = d.jb <= d.gm ? [d.jb, d.gm] : [d.gm, d.jb];
          // When the dots would overlap (tiny gap), nudge them apart vertically
          // so neither hides the other; the exact values are in the text above.
          const close = (right - left) / (hi - lo) < 0.04;
          return (
            <li key={d.slug} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <Link href={`/cocktails/${d.slug}`} prefetch={false} className="font-semibold text-ink underline-offset-2 hover:underline">
                  {d.name}
                </Link>
                <span className="shrink-0 text-xs text-ink-soft">
                  JB {d.jb} · GM {d.gm} · gap {d.gap}
                </span>
              </div>
              <div aria-hidden="true" className="relative mx-1.5 h-4">
                <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-chart-grid" />
                <div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-faint/50"
                  style={{ left: pos(left), width: `calc(${pos(right)} - ${pos(left)})` }}
                />
                {TASTERS.map((t, i) => (
                  <span
                    key={t.key}
                    title={`${t.name}: ${d[t.key]}`}
                    className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${t.color}`}
                    style={{ left: pos(d[t.key]), marginTop: close ? (i === 0 ? -3 : 3) : 0 }}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="relative mx-1.5 h-4 border-t border-chart-grid">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute top-1 -translate-x-1/2 text-[11px] text-ink-faint"
            style={{ left: pos(t) }}
          >
            {t}
          </span>
        ))}
      </div>
    </figure>
  );
}

export default async function StatsPage() {
  let stats: DashboardStats | null = null;
  try {
    stats = computeDashboardStats(await fetchCocktailRecords());
  } catch {
    stats = null;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-8 pt-6 sm:max-w-lg">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 px-1 text-sm font-semibold text-teal underline-offset-2 hover:underline"
      >
        <span aria-hidden="true">←</span> All cocktails
      </Link>

      <header className="tiki-header relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-lg">
        <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-6 text-8xl opacity-20">
          🌺
        </span>
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          Adventures in Tiki
        </p>
        <h1 className="relative mt-1 text-3xl font-extrabold tracking-tight">Our stats</h1>
        {stats && (
          <>
            <p className="relative mt-4 text-5xl font-extrabold leading-none">
              {stats.tried}
              <span className="text-lg font-semibold text-white/85"> of {stats.total} tasted</span>
            </p>
          </>
        )}
      </header>

      {!stats ? (
        <p role="alert" className="rounded-2xl border border-coral/30 bg-card p-3 text-sm text-coral-deep shadow-sm">
          Couldn&apos;t load the stats right now. Please try refreshing the page.
        </p>
      ) : (
        <>
          <section aria-labelledby="progress-heading" className="flex flex-col gap-3">
            <SectionHeading id="progress-heading">Progress through the list</SectionHeading>
            <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-ink">All {stats.total}</span>
                  <span className="tabular-nums text-ink-soft">
                    {stats.tried} / {stats.total} · {Math.round((stats.tried / Math.max(1, stats.total)) * 100)}%
                  </span>
                </div>
                <Meter value={stats.tried} total={stats.total} label={`Tasted, all ${stats.total}`} />
              </div>
              {stats.bands.map((b) => (
                <div key={b.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">Difford&apos;s #{b.label}</span>
                    <span className="tabular-nums text-ink-soft">
                      {b.tried} / {b.total}
                    </span>
                  </div>
                  <Meter value={b.tried} total={b.total} label={`Tasted, Difford's ${b.label}`} />
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="tasters-heading" className="flex flex-col gap-3">
            <SectionHeading id="tasters-heading">John vs Genny</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <TasterTile initials="JB" name="John" stats={stats.jb} />
              <TasterTile initials="GM" name="Genny" stats={stats.gm} />
              <div className="rounded-2xl border border-teal/15 bg-sand-deep p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal">Rated by both</p>
                <p className="text-2xl font-bold text-teal-deep">{stats.bothRated}</p>
              </div>
              <div className="rounded-2xl border border-teal/15 bg-sand-deep p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal">Average gap</p>
                <p className="text-2xl font-bold text-teal-deep">{stats.averageGap ?? "—"}</p>
                <p className="text-xs text-ink-soft">points apart</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="spread-heading" className="flex flex-col gap-3">
            <SectionHeading id="spread-heading">Rating spread</SectionHeading>
            <RatingSpread histogram={stats.histogram} />
          </section>

          {stats.disagreements.length > 0 && (
            <section aria-labelledby="disagree-heading" className="flex flex-col gap-3">
              <SectionHeading id="disagree-heading">Where we disagree</SectionHeading>
              <Disagreements items={stats.disagreements} />
            </section>
          )}

          {stats.topRated.length > 0 && (
            <section aria-labelledby="top-heading" className="flex flex-col gap-3">
              <SectionHeading id="top-heading">Our favorites</SectionHeading>
              <ol className="flex flex-col gap-2">
                {stats.topRated.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/cocktails/${t.slug}`}
                      prefetch={false}
                      className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm hover:shadow-md"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral-deep text-xs font-bold text-white">
                        <span className="sr-only">Rank </span>
                        {t.rank}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-ink">{t.name}</span>
                      <span className="rounded-full bg-teal-deep px-2.5 py-1 text-xs font-bold text-white">
                        <span className="sr-only">Average rating </span>
                        {t.avgRating}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </main>
  );
}
