import { describe, expect, it } from "vitest";
import { summarizeShopping, withParam } from "./shopping";

const d = (slug: string, rank: number, tried: boolean, ingredientTexts: string[]) => ({
  slug,
  name: slug,
  diffordsRank: rank,
  tried,
  ingredientTexts,
});

// Recipe wordings from the Top 100 (all in INGREDIENT_ALIASES).
const NAVY = "Navy rum (ideally circa 55% alc./vol.)";
const PINE = "Pineapple juice";
const COCO = "Cream of coconut (e.g. Coco Lopez, Re'al etc.)";
const LIME = "Lime juice (freshly squeezed)";

describe("summarizeShopping", () => {
  const painkiller = d("painkiller", 30, false, [NAVY, PINE, COCO]);
  const navyPine = d("navy-pine", 10, true, [NAVY, PINE, LIME]);
  const needsThree = d("far-off", 5, false, [NAVY, PINE, COCO, "Falernum liqueur"]);

  it("credits each item with the drinks the whole list would complete", () => {
    const s = summarizeShopping([painkiller, navyPine, needsThree], new Set(["navy-rum"]), ["pineapple-juice", "cream-of-coconut"]);
    expect(s.unlocks.map((x) => x.slug)).toEqual(["painkiller", "navy-pine"]); // untried first
    const pine = s.items.find((i) => i.ingredientId === "pineapple-juice")!;
    expect(pine.completes.map((x) => x.slug)).toEqual(["painkiller", "navy-pine"]);
    expect(pine.usedBy).toBe(3);
    expect(s.items[0].ingredientId).toBe("pineapple-juice"); // most completes first
  });

  it("drops unknown ids, duplicates and things we already have", () => {
    const s = summarizeShopping([painkiller], new Set(["navy-rum"]), ["navy-rum", "nope", "pineapple-juice", "pineapple-juice"]);
    expect(s.items.map((i) => i.ingredientId)).toEqual(["pineapple-juice"]);
    expect(s.unlocks).toEqual([]);
  });

  it("ignores drinks we can already make", () => {
    const s = summarizeShopping([navyPine], new Set(["navy-rum", "pineapple-juice"]), ["cream-of-coconut"]);
    expect(s.unlocks).toEqual([]);
    expect(s.items[0].usedBy).toBe(0);
  });
});

describe("summarizeShopping edge cases", () => {
  it("ignores staples on the list", () => {
    const s = summarizeShopping([], new Set(), ["lime", "pineapple-juice"]);
    expect(s.items.map((i) => i.ingredientId)).toEqual(["pineapple-juice"]);
  });

  it("never promises a drink with recipe lines the catalog doesn't know", () => {
    const odd = d("odd", 1, false, [PINE, "Mystery bitters"]);
    const s = summarizeShopping([odd], new Set(), ["pineapple-juice"]);
    expect(s.unlocks).toEqual([]);
    expect(s.items[0].completes).toEqual([]);
    expect(s.items[0].usedBy).toBe(1);
  });
});

describe("withParam", () => {
  it("can't be tricked into an off-site redirect", () => {
    for (const p of ["/.//evil.com", "/..//evil.com", "/%2e//evil.com", "//evil.com", "https://evil.com"]) {
      expect(withParam(p, "shopping", "added")).toBe("/?shopping=added");
    }
  });

  it("adds to a path with or without a query, keeping the hash", () => {
    expect(withParam("/cabinet", "shopping", "error")).toBe("/cabinet?shopping=error");
    expect(withParam("/?show=untasted#x", "a", "1")).toBe("/?show=untasted&a=1#x");
  });
});

describe("restocking", () => {
  it("keeps an owned item on the list only when it's running low", () => {
    const drinks = [{ slug: "p", name: "P", diffordsRank: 1, tried: false, ingredientTexts: ["Pineapple juice"] }];
    expect(summarizeShopping(drinks, new Set(["pineapple-juice"]), ["pineapple-juice"]).items).toEqual([]);
    const s = summarizeShopping(drinks, new Set(["pineapple-juice"]), ["pineapple-juice"], new Set(["pineapple-juice"]));
    expect(s.items).toEqual([{ ingredientId: "pineapple-juice", completes: [], usedBy: 0, restock: true }]);
  });
});
