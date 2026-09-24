import { describe, expect, it } from "vitest";
import { filterCocktails, parseListFilter, type ListedCocktail } from "./list";

function make(name: string, diffordsRank: number, tried: boolean, rank: number | null): ListedCocktail {
  return {
    name,
    slug: name.toLowerCase(),
    diffordsRank,
    diffordsGuideUrl: "https://example.com",
    primarySpirits: [],
    ingredientTexts: [],
    tried,
    jbRating: null,
    gmRating: null,
    avgRating: rank === null ? null : 10 - rank,
    rank,
  };
}

const records = [
  make("C", 3, true, 1),
  make("A", 1, false, null),
  make("D", 4, true, null), // tried but unrated
  make("B", 2, true, 2),
  make("E", 5, false, null),
];

describe("parseListFilter", () => {
  it("accepts the known values", () => {
    expect(parseListFilter("tasted")).toBe("tasted");
    expect(parseListFilter("untasted")).toBe("untasted");
    expect(parseListFilter("all")).toBe("all");
  });
  it("falls back to 'all' for missing or unknown values", () => {
    expect(parseListFilter(undefined)).toBe("all");
    expect(parseListFilter("bogus")).toBe("all");
    expect(parseListFilter(["tasted", "all"])).toBe("tasted");
  });
});

describe("filterCocktails", () => {
  it("'all' returns every cocktail in Difford's order without mutating the input", () => {
    const before = records.map((r) => r.name);
    expect(filterCocktails(records, "all").map((r) => r.name)).toEqual(["A", "B", "C", "D", "E"]);
    expect(records.map((r) => r.name)).toEqual(before);
  });
  it("'tasted' returns tried cocktails best-first, unrated ones last", () => {
    expect(filterCocktails(records, "tasted").map((r) => r.name)).toEqual(["C", "B", "D"]);
  });
  it("'untasted' returns untried cocktails in Difford's order", () => {
    expect(filterCocktails(records, "untasted").map((r) => r.name)).toEqual(["A", "E"]);
  });
});
