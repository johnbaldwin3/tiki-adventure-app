import { describe, expect, it } from "vitest";
import type { CocktailRecord } from "./cocktails";
import { computeDashboardStats, takeWithTies } from "./stats";

function rec(
  diffordsRank: number,
  tried: boolean,
  jbRating: number | null = null,
  gmRating: number | null = null
): CocktailRecord {
  const name = `Drink ${diffordsRank}`;
  return {
    name,
    slug: `drink-${diffordsRank}`,
    diffordsRank,
    diffordsGuideUrl: "https://example.com",
    primarySpirits: [],
    tried,
    jbRating,
    gmRating,
  };
}

// 100 cocktails; a handful tried with a spread of ratings.
const records: CocktailRecord[] = Array.from({ length: 100 }, (_, i) => rec(i + 1, false));
records[0] = rec(1, true, 9.5, 9.0); // both, gap 0.5
records[4] = rec(5, true, 8.0, 6.0); // both, gap 2
records[29] = rec(30, true, 7.0, 7.0); // both, gap 0 (not a disagreement)
records[59] = rec(60, true, 10, null); // JB only, 10 lands in the top bin
records[99] = rec(100, true, 5.5, 6.99); // both, gap 1.49; 5.5 -> "Under 6", 6.99 -> "6–7"
records[50] = rec(51, true); // tried, unrated

describe("computeDashboardStats", () => {
  const s = computeDashboardStats(records);

  it("counts overall and per-band progress through Difford's list", () => {
    expect(s.tried).toBe(6);
    expect(s.total).toBe(100);
    expect(s.bands).toEqual([
      { label: "1–25", tried: 2, total: 25 },
      { label: "26–50", tried: 1, total: 25 },
      { label: "51–75", tried: 2, total: 25 },
      { label: "76–100", tried: 1, total: 25 },
    ]);
  });

  it("summarizes each taster, ignoring unrated tastings", () => {
    expect(s.jb).toEqual({
      ratedCount: 5,
      average: 8,
      highest: { name: "Drink 60", slug: "drink-60", rating: 10 },
      lowest: { name: "Drink 100", slug: "drink-100", rating: 5.5 },
    });
    expect(s.gm.ratedCount).toBe(4);
    expect(s.gm.average).toBe(7.25);
    expect(s.gm.highest?.rating).toBe(9);
    expect(s.gm.lowest?.name).toBe("Drink 5");
  });

  it("bins ratings with half-open ranges and 10 in the top bin", () => {
    expect(s.histogram.map((b) => [b.label, b.jb, b.gm])).toEqual([
      ["Under 6", 1, 0],
      ["6–7", 0, 2],
      ["7–8", 1, 1],
      ["8–9", 1, 0],
      ["9–10", 2, 1],
    ]);
    const totalJb = s.histogram.reduce((n, b) => n + b.jb, 0);
    expect(totalJb).toBe(s.jb.ratedCount);
  });

  it("lists disagreements biggest gap first, excluding exact agreement", () => {
    expect(s.bothRated).toBe(4);
    expect(s.averageGap).toBe(1); // (0.5 + 2 + 0 + 1.49) / 4 = 0.9975 -> 1
    expect(s.disagreements.map((d) => [d.name, d.gap])).toEqual([
      ["Drink 5", 2],
      ["Drink 100", 1.49],
      ["Drink 1", 0.5],
    ]);
  });

  it("returns the top rated by average, matching rankCocktails", () => {
    expect(s.topRated.map((t) => [t.rank, t.name, t.avgRating])).toEqual([
      [1, "Drink 60", 10],
      [2, "Drink 1", 9.25],
      [3, "Drink 5", 7],
      [3, "Drink 30", 7],
      [5, "Drink 100", 6.25],
    ]);
  });

  it("handles no data at all", () => {
    const empty = computeDashboardStats([]);
    expect(empty.tried).toBe(0);
    expect(empty.jb).toEqual({ ratedCount: 0, average: null, highest: null, lowest: null });
    expect(empty.averageGap).toBeNull();
    expect(empty.disagreements).toEqual([]);
    expect(empty.topRated).toEqual([]);
    expect(empty.bands.every((b) => b.total === 0)).toBe(true);
  });
});

describe("computeDashboardStats edge cases", () => {
  const base = () => Array.from({ length: 10 }, (_, i) => rec(i + 1, false));

  it("uses the same cocktail as favorite and lowest when a taster has one rating", () => {
    const rs = base();
    rs[2] = rec(3, true, 7.5, null);
    const s = computeDashboardStats(rs);
    expect(s.jb.highest).toEqual(s.jb.lowest);
    expect(s.jb.average).toBe(7.5);
  });

  it("breaks favorite/lowest ties by Difford's rank", () => {
    const rs = base();
    rs[6] = rec(7, true, 9, 5);
    rs[1] = rec(2, true, 9, 5);
    const s = computeDashboardStats(rs);
    expect(s.jb.highest?.name).toBe("Drink 2");
    expect(s.gm.lowest?.name).toBe("Drink 2");
  });

  it("bins exact boundaries into the higher bin", () => {
    const rs = base();
    rs[0] = rec(1, true, 5.99, 6);
    rs[1] = rec(2, true, 8.99, 9);
    rs[2] = rec(3, true, 0, 10);
    const s = computeDashboardStats(rs);
    const bins = Object.fromEntries(s.histogram.map((b) => [b.label, [b.jb, b.gm]]));
    expect(bins["Under 6"]).toEqual([2, 0]);
    expect(bins["6–7"]).toEqual([0, 1]);
    expect(bins["8–9"]).toEqual([1, 0]);
    expect(bins["9–10"]).toEqual([0, 2]);
  });

  it("skips (rather than crashes on) an out-of-range rating", () => {
    const rs = base();
    rs[0] = rec(1, true, 11, -1);
    const s = computeDashboardStats(rs);
    expect(s.histogram.reduce((n, b) => n + b.jb + b.gm, 0)).toBe(0);
  });

  it("keeps ties at the top-N cutoff instead of splitting them", () => {
    const rs = base();
    [9, 8.5, 8, 7.5, 7, 7].forEach((r, i) => (rs[i] = rec(i + 1, true, r, r)));
    const s = computeDashboardStats(rs, 5);
    expect(s.topRated.map((t) => t.rank)).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it("caps disagreements at topN, keeping ties at the cutoff", () => {
    const rs = base();
    [3, 2, 1, 1, 0.5].forEach((gap, i) => (rs[i] = rec(i + 1, true, 5 + gap, 5)));
    expect(computeDashboardStats(rs, 3).disagreements.map((d) => d.gap)).toEqual([3, 2, 1, 1]);
    expect(computeDashboardStats(rs, 2).disagreements.map((d) => d.gap)).toEqual([3, 2]);
  });
});

describe("takeWithTies", () => {
  it("returns everything when the list is short", () => {
    expect(takeWithTies([1, 2], 5, (x) => x)).toEqual([1, 2]);
  });
  it("extends past n only for items tied with the n-th", () => {
    expect(takeWithTies([1, 2, 2, 2, 3], 2, (x) => x)).toEqual([1, 2, 2, 2]);
    expect(takeWithTies([1, 2, 3, 3], 2, (x) => x)).toEqual([1, 2]);
  });
});
