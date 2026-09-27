import { describe, expect, it } from "vitest";
import {
  filterCocktails,
  foldForSearch,
  listHref,
  matchesSearch,
  parseSearch,
  searchText,
  matchesIngredients,
  parseIngredientFilter,
  parseIngredientMatch,
  parseListFilter,
  type ListedCocktail,
} from "./list";

function make(name: string, diffordsRank: number, tried: boolean, rank: number | null): ListedCocktail {
  return {
    name,
    slug: name.toLowerCase(),
    diffordsRank,
    ingredientIds: [],
    source: "diffords",
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

describe("ingredient filter helpers", () => {
  const known = (id: string) => ["navy-rum", "falernum", "lime"].includes(id);

  it("parses ?ing= and ?add=, dropping unknown ids and duplicates, keeping order", () => {
    expect(parseIngredientFilter("navy-rum,bogus,falernum", undefined, known)).toEqual(["navy-rum", "falernum"]);
    expect(parseIngredientFilter("navy-rum", "falernum", known)).toEqual(["navy-rum", "falernum"]);
    expect(parseIngredientFilter(["navy-rum", "lime"], "navy-rum", known)).toEqual(["navy-rum", "lime"]);
    expect(parseIngredientFilter(undefined, "", known)).toEqual([]);
    expect(parseIngredientFilter("navy-rum", "unicorn-tears", known)).toEqual(["navy-rum"]);
    expect(parseIngredientFilter(undefined, ["falernum", "lime"], known)).toEqual(["falernum", "lime"]);
  });

  it("defaults match to 'all'", () => {
    expect(parseIngredientMatch(undefined)).toBe("all");
    expect(parseIngredientMatch("any")).toBe("any");
    expect(parseIngredientMatch("nope")).toBe("all");
  });

  it("matches all or any selected ingredients", () => {
    const has = new Set(["navy-rum", "lime"]);
    expect(matchesIngredients(has, [], "all")).toBe(true);
    expect(matchesIngredients(has, ["navy-rum", "lime"], "all")).toBe(true);
    expect(matchesIngredients(has, ["navy-rum", "falernum"], "all")).toBe(false);
    expect(matchesIngredients(has, ["navy-rum", "falernum"], "any")).toBe(true);
    expect(matchesIngredients(has, ["falernum"], "any")).toBe(false);
  });

  it("builds canonical list URLs", () => {
    expect(listHref({})).toBe("/");
    expect(listHref({ show: "tasted" })).toBe("/?show=tasted");
    expect(listHref({ ing: ["navy-rum", "falernum"] })).toBe("/?ing=navy-rum,falernum");
    expect(listHref({ show: "untasted", ing: ["navy-rum", "falernum"], match: "any" })).toBe(
      "/?show=untasted&ing=navy-rum,falernum&match=any"
    );
    // "any" is meaningless with a single ingredient, so it's dropped.
    expect(listHref({ ing: ["navy-rum"], match: "any" })).toBe("/?ing=navy-rum");
  });
});

describe("search", () => {
  const zombie = searchText({
    name: "Zombie",
    primarySpirits: ["Jamaican Rum", "Demerara Rum"],
    ingredients: ["Falernum liqueur", "Aged Jamaican rum (funky)", "Pernod anise"],
  });
  const pina = searchText({ name: "Piña Colada", primarySpirits: ["Light White Rum"], ingredients: ["Pineapple juice"] });
  const mai = searchText({ name: "Mai-Tai (Trader Vic's)", primarySpirits: [], ingredients: [] });

  it.each([
    [zombie, "zombie", true],
    [zombie, "ZOM", true],
    [zombie, "jamaican falernum", true],
    [zombie, "falernum gin", false],
    [zombie, "rum", true],
    [pina, "pina", true],
    [pina, "piña colada", true],
    [pina, "ina", false], // matches from the start of a word only
    [mai, "mai tai", true],
    [mai, "trader vics", true],
    [mai, "", true],
  ])("%s ~ %s -> %s", (hay, q, expected) => {
    expect(matchesSearch(hay, q)).toBe(expected);
  });

  it("parses ?q= safely", () => {
    expect(parseSearch(undefined)).toBe("");
    expect(parseSearch(["  mai   tai ", "x"])).toBe("mai tai");
    expect(parseSearch("a".repeat(80))).toHaveLength(60);
    expect(parseSearch("🍹 ---")).toBe("");
  });

  it("folds accents, case and punctuation", () => {
    expect(foldForSearch("Piña Colada")).toBe("pina colada");
    expect(foldForSearch("Difford's")).toBe("diffords");
  });

  it("keeps the search in list links", () => {
    expect(listHref({ q: "mai tai", show: "untasted" })).toBe("/?q=mai+tai&show=untasted");
  });
});
