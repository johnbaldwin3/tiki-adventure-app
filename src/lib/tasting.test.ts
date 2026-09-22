import { describe, expect, it } from "vitest";
import { averageRating, rankCocktails, summarizeProgress } from "./tasting";

describe("averageRating", () => {
  it("averages JB and GM ratings when both are present, rounded to 2dp", () => {
    // Matches the original spreadsheet: JB 8.90, GM 8.71 -> Avg 8.81.
    expect(averageRating(8.9, 8.71)).toBe(8.81);
  });

  it("returns the single rating when only one taster has rated", () => {
    expect(averageRating(9.41, null)).toBe(9.41);
    expect(averageRating(null, 7.2)).toBe(7.2);
  });

  it("returns null when neither taster has rated", () => {
    expect(averageRating(null, null)).toBeNull();
    expect(averageRating(undefined, undefined)).toBeNull();
  });
});

describe("rankCocktails", () => {
  it("ranks rated cocktails by descending average, leaving unrated ones blank", () => {
    const records = [
      { name: "Tiki Max", tried: true, jbRating: null, gmRating: 9.41 },
      { name: "Painkiller", tried: true, jbRating: 8.59, gmRating: null },
      { name: "Untasted Drink", tried: false, jbRating: null, gmRating: null },
      { name: "Three Dots and a Dash", tried: true, jbRating: 8.9, gmRating: 8.71 },
    ];

    const ranked = rankCocktails(records);
    const byName = Object.fromEntries(ranked.map((r) => [r.name, r]));

    expect(byName["Tiki Max"].rank).toBe(1);
    expect(byName["Three Dots and a Dash"].rank).toBe(2);
    expect(byName["Painkiller"].rank).toBe(3);
    expect(byName["Untasted Drink"].rank).toBeNull();
    expect(byName["Untasted Drink"].avgRating).toBeNull();
  });

  it("gives tied averages the same rank", () => {
    const records = [
      { name: "A", tried: true, jbRating: 8, gmRating: 8 },
      { name: "B", tried: true, jbRating: 8, gmRating: 8 },
      { name: "C", tried: true, jbRating: 7, gmRating: 7 },
    ];
    const ranked = rankCocktails(records);
    const byName = Object.fromEntries(ranked.map((r) => [r.name, r]));
    expect(byName["A"].rank).toBe(1);
    expect(byName["B"].rank).toBe(1);
    expect(byName["C"].rank).toBe(3);
  });
});

describe("summarizeProgress", () => {
  it("computes tasted count, progress fraction, and per-taster averages", () => {
    const records = [
      { name: "A", tried: true, jbRating: 8, gmRating: 9 },
      { name: "B", tried: true, jbRating: 6, gmRating: null },
      { name: "C", tried: false, jbRating: null, gmRating: null },
    ];
    const summary = summarizeProgress(records);
    expect(summary.triedCount).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.fraction).toBeCloseTo(2 / 3, 5);
    expect(summary.jbAverage).toBe(7);
    expect(summary.gmAverage).toBe(9);
  });

  it("returns null averages when nobody has rated anything", () => {
    const summary = summarizeProgress([
      { name: "A", tried: false, jbRating: null, gmRating: null },
    ]);
    expect(summary.jbAverage).toBeNull();
    expect(summary.gmAverage).toBeNull();
  });
});
