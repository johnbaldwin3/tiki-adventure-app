import type { CocktailRecord } from "./cocktails";
import { rankCocktails } from "./tasting";

/**
 * Pure stats for the /stats dashboard (Phase 5). Builds on tasting.ts's
 * averaging/ranking rather than re-deriving them, so the dashboard always
 * agrees with the home list and recipe cards.
 */

export interface RatedCocktail {
  name: string;
  slug: string;
  rating: number;
}

export interface TasterStats {
  ratedCount: number;
  average: number | null;
  highest: RatedCocktail | null;
  lowest: RatedCocktail | null;
}

export interface BandProgress {
  label: string; // "1–25"
  tried: number;
  total: number;
}

export interface HistogramBin {
  label: string;
  /** Inclusive lower bound; upper bound is exclusive except for the last bin (10 is included). */
  min: number;
  max: number;
  jb: number;
  gm: number;
}

export interface Disagreement {
  name: string;
  slug: string;
  jb: number;
  gm: number;
  gap: number;
}

export interface TopRated {
  name: string;
  slug: string;
  avgRating: number;
  rank: number;
}

export interface DashboardStats {
  tried: number;
  total: number;
  bands: BandProgress[];
  jb: TasterStats;
  gm: TasterStats;
  bothRated: number;
  averageGap: number | null;
  histogram: HistogramBin[];
  topRated: TopRated[];
  disagreements: Disagreement[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isNum = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

export const HISTOGRAM_BINS: Pick<HistogramBin, "label" | "min" | "max">[] = [
  { label: "Under 6", min: 0, max: 6 },
  { label: "6–7", min: 6, max: 7 },
  { label: "7–8", min: 7, max: 8 },
  { label: "8–9", min: 8, max: 9 },
  { label: "9–10", min: 9, max: 10 },
];

function binIndex(rating: number): number {
  return HISTOGRAM_BINS.findIndex((b, i) =>
    i === HISTOGRAM_BINS.length - 1 ? rating >= b.min && rating <= b.max : rating >= b.min && rating < b.max
  );
}

function tasterStats(records: CocktailRecord[], pick: (r: CocktailRecord) => unknown): TasterStats {
  const rated = records
    .filter((r) => isNum(pick(r)))
    .map((r) => ({ name: r.name, slug: r.slug, rating: pick(r) as number, diffordsRank: r.diffordsRank }));
  if (rated.length === 0) return { ratedCount: 0, average: null, highest: null, lowest: null };

  // Ties go to the higher Difford's-ranked cocktail so results are stable.
  const byRating = rated
    .slice()
    .sort((a, b) => b.rating - a.rating || a.diffordsRank - b.diffordsRank);
  const strip = ({ name, slug, rating }: (typeof rated)[number]) => ({ name, slug, rating });
  const lowestRating = byRating[byRating.length - 1].rating;
  return {
    ratedCount: rated.length,
    average: round2(rated.reduce((s, r) => s + r.rating, 0) / rated.length),
    highest: strip(byRating[0]),
    lowest: strip(byRating.find((r) => r.rating === lowestRating)!),
  };
}

/**
 * First `n` items of an already-sorted list, extended to include any items
 * tied with the n-th (so a tie at the cutoff is never split arbitrarily).
 */
export function takeWithTies<T>(sorted: T[], n: number, key: (item: T) => number): T[] {
  if (sorted.length <= n) return sorted.slice();
  const cutoff = key(sorted[n - 1]);
  let end = n;
  while (end < sorted.length && key(sorted[end]) === cutoff) end += 1;
  return sorted.slice(0, end);
}

export function computeDashboardStats(records: CocktailRecord[], topN = 5): DashboardStats {
  const tried = records.filter((r) => r.tried).length;

  const bands: BandProgress[] = [1, 26, 51, 76].map((from) => {
    const to = from + 24;
    const inBand = records.filter((r) => r.diffordsRank >= from && r.diffordsRank <= to);
    return { label: `${from}–${to}`, tried: inBand.filter((r) => r.tried).length, total: inBand.length };
  });

  const histogram: HistogramBin[] = HISTOGRAM_BINS.map((b) => ({ ...b, jb: 0, gm: 0 }));
  // Out-of-range ratings can't happen (DB check 0-10), but skip rather than crash.
  for (const r of records) {
    const jbBin = isNum(r.jbRating) ? binIndex(r.jbRating) : -1;
    const gmBin = isNum(r.gmRating) ? binIndex(r.gmRating) : -1;
    if (jbBin >= 0) histogram[jbBin].jb += 1;
    if (gmBin >= 0) histogram[gmBin].gm += 1;
  }

  const both = records.filter((r) => isNum(r.jbRating) && isNum(r.gmRating));
  const gaps = both.map((r) => ({
    name: r.name,
    slug: r.slug,
    jb: r.jbRating as number,
    gm: r.gmRating as number,
    gap: round2(Math.abs((r.jbRating as number) - (r.gmRating as number))),
    diffordsRank: r.diffordsRank,
  }));
  const sortedGaps = gaps
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.diffordsRank - b.diffordsRank);
  const disagreements = takeWithTies(sortedGaps, topN, (g) => g.gap)
    .map(({ name, slug, jb, gm, gap }) => ({ name, slug, jb, gm, gap }));

  const bySlug = new Map(records.map((r) => [r.name, r.slug]));
  const ranked = rankCocktails(records)
    .filter((r): r is typeof r & { rank: number; avgRating: number } => r.rank !== null && r.avgRating !== null)
    .sort((a, b) => a.rank - b.rank);
  const topRated = takeWithTies(ranked, topN, (r) => r.rank)
    .map((r) => ({ name: r.name, slug: bySlug.get(r.name)!, avgRating: r.avgRating, rank: r.rank }));

  return {
    tried,
    total: records.length,
    bands,
    jb: tasterStats(records, (r) => r.jbRating),
    gm: tasterStats(records, (r) => r.gmRating),
    bothRated: both.length,
    averageGap: gaps.length ? round2(gaps.reduce((s, g) => s + g.gap, 0) / gaps.length) : null,
    histogram,
    topRated,
    disagreements,
  };
}
