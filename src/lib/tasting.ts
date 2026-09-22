/**
 * Core tasting-log math, mirroring the original spreadsheet's formulas:
 *  - Avg Rating: average of JB and GM ratings, blank if neither has rated.
 *  - Rank: competition rank (Excel/SQL RANK() semantics) by Avg Rating,
 *    descending — ties share a rank and the next rank skips (e.g. 1, 1, 3),
 *    which is NOT the same as dense rank. Blank for unrated cocktails.
 *  - Progress: fraction of the 100-cocktail list marked as tried.
 */

export type Rating = number | null | undefined;

export interface TastingRecord {
  name: string;
  tried: boolean;
  jbRating: Rating;
  gmRating: Rating;
}

export interface RankedTastingRecord extends TastingRecord {
  avgRating: number | null;
  rank: number | null;
}

/** Average of JB and GM ratings. Returns null if neither rating is present. */
export function averageRating(jbRating: Rating, gmRating: Rating): number | null {
  const values = [jbRating, gmRating].filter(
    (v): v is number => typeof v === "number" && !Number.isNaN(v)
  );
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/**
 * Ranks a list of tasting records by average rating, descending.
 * Unrated cocktails (avgRating === null) get rank: null, matching the
 * spreadsheet's `=IF(ISNUMBER(J8), RANK(...), "")` behavior. Ties share
 * the same rank (standard competition ranking, like Excel's RANK()).
 */
export function rankCocktails(records: TastingRecord[]): RankedTastingRecord[] {
  const withAverages = records.map((r) => ({
    ...r,
    avgRating: averageRating(r.jbRating, r.gmRating),
  }));

  const sortedRated = withAverages
    .filter((r): r is typeof r & { avgRating: number } => r.avgRating !== null)
    .slice()
    .sort((a, b) => b.avgRating - a.avgRating);

  const rankByName = new Map<string, number>();
  let rank = 0;
  let lastAvg: number | null = null;
  let position = 0;
  for (const r of sortedRated) {
    position += 1;
    if (r.avgRating !== lastAvg) {
      rank = position;
      lastAvg = r.avgRating;
    }
    rankByName.set(r.name, rank);
  }

  return withAverages.map((r) => ({
    ...r,
    rank: rankByName.get(r.name) ?? null,
  }));
}

export interface ProgressSummary {
  triedCount: number;
  total: number;
  fraction: number;
  jbAverage: number | null;
  gmAverage: number | null;
}

/** Mirrors the KPI scorecard formulas: tasted count, progress %, JB/GM overall averages. */
export function summarizeProgress(records: TastingRecord[]): ProgressSummary {
  const total = records.length;
  const triedCount = records.filter((r) => r.tried).length;

  const jbValues = records
    .map((r) => r.jbRating)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  const gmValues = records
    .map((r) => r.gmRating)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));

  const avg = (values: number[]) =>
    values.length === 0
      ? null
      : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;

  return {
    triedCount,
    total,
    fraction: total === 0 ? 0 : triedCount / total,
    jbAverage: avg(jbValues),
    gmAverage: avg(gmValues),
  };
}
