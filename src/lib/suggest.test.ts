import { describe, expect, it } from "vitest";
import { shortIngredientName, suggestionReasons } from "@/components/suggestion-card";
import { suggestNext, type SuggestDrink } from "./suggest";

// Recipe wordings from the Top 100 (all in INGREDIENT_ALIASES).
const NAVY = "Navy rum (ideally circa 55% alc./vol.)";
const PINE = "Pineapple juice";
const COCO = "Cream of coconut (e.g. Coco Lopez, Re'al etc.)";
const FALERNUM = "Falernum liqueur";
const LIME = "Lime juice (freshly squeezed)";

const d = (slug: string, rank: number, tried: boolean, avgRating: number | null, ingredientTexts: string[]): SuggestDrink => ({
  slug,
  name: slug,
  diffordsRank: rank,
  tried,
  avgRating,
  ingredientTexts,
});

describe("suggestNext", () => {
  const loved = d("loved", 50, true, 9, [NAVY, PINE, LIME]);
  const meh = d("meh", 51, true, 5, [FALERNUM, LIME]);
  const likeLoved = d("like-loved", 90, false, null, [NAVY, PINE, COCO]);
  const likeMeh = d("like-meh", 1, false, null, [FALERNUM, COCO]);
  const unrelated = d("unrelated", 2, false, null, [COCO]);

  it("ranks untried drinks like the ones we loved first, and explains why", () => {
    const s = suggestNext([loved, meh, likeLoved, likeMeh, unrelated]);
    expect(s.map((x) => x.drink.slug)).toEqual(["like-loved", "unrelated", "like-meh"]);
    expect(s[0].like?.drink.slug).toBe("loved");
    expect(s[0].like?.shared).toEqual(["navy-rum", "pineapple-juice"]);
    expect(s[2].like).toBeNull(); // only resembles one we rated low
    expect(s.every((x) => x.missing === null)).toBe(true);
  });

  it("gives a bonus for what our bar can make, and never suggests tried drinks", () => {
    const s = suggestNext([loved, meh, likeLoved, likeMeh, unrelated], { have: new Set(["falernum", "cream-of-coconut"]) });
    // "unrelated" can be made now, so it jumps ahead of "like-loved".
    expect(s.map((x) => x.drink.slug)).toEqual(["unrelated", "like-loved", "like-meh"]);
    expect(s[0].missing).toEqual([]);
    expect(s.find((x) => x.drink.slug === "like-loved")!.missing).toEqual(["navy-rum", "pineapple-juice"]);
    expect(s.some((x) => x.drink.tried)).toBe(false);
  });

  it("falls back to Difford's order with nothing rated", () => {
    const s = suggestNext([likeLoved, likeMeh, unrelated]);
    expect(s.map((x) => x.drink.slug)).toEqual(["like-meh", "unrelated", "like-loved"]);
  });

  it("respects the limit", () => {
    expect(suggestNext([likeLoved, likeMeh, unrelated], { limit: 2 })).toHaveLength(2);
  });
});

describe("suggestNext edge cases", () => {
  const loved = d("loved", 50, true, 9, [NAVY, PINE, LIME]);
  const meh = d("meh", 51, true, 5, [FALERNUM, LIME]);

  it("gives a smaller bonus one ingredient away", () => {
    const oneAway = d("one-away", 80, false, null, [COCO, FALERNUM]);
    const far = d("far", 1, false, null, [NAVY, COCO, FALERNUM]);
    const s = suggestNext([oneAway, far], { have: new Set(["cream-of-coconut"]) });
    expect(s[0].drink.slug).toBe("one-away");
    expect(s[0].missing).toEqual(["falernum"]);
  });

  it("never claims we can make a drink with recipe lines it doesn't know", () => {
    const odd = d("odd", 1, false, null, [COCO, "Mystery bitters"]);
    const [s] = suggestNext([odd], { have: new Set(["cream-of-coconut"]) });
    expect(s.missing).toBeNull();
    expect(s.score).toBe(0);
  });

  it("copes with a drink with no catalog ingredients", () => {
    const bare = d("bare", 3, false, null, []);
    expect(suggestNext([loved, bare])[0]).toMatchObject({ like: null, score: 0 });
  });

  it("only points to drinks we rated above our average", () => {
    const single = suggestNext([loved, d("x", 1, false, null, [NAVY])]);
    expect(single[0].like).toBeNull(); // the only rating IS the average
    const s = suggestNext([loved, meh, d("y", 1, false, null, [NAVY, FALERNUM])]);
    expect(s[0].like?.drink.slug).toBe("loved");
  });
});

describe("suggestionReasons", () => {
  const loved = d("Loved One", 50, true, 8.75, [NAVY, PINE, COCO, LIME]);
  const s = suggestNext([loved, d("meh", 51, true, 5, [FALERNUM]), d("pick", 7, false, null, [NAVY, PINE, COCO])], {
    have: new Set(["navy-rum", "pineapple-juice"]),
  })[0];

  it("explains in plain words, keeping ingredient names' casing", () => {
    expect(suggestionReasons(s)).toEqual([
      "Just need Cream of coconut",
      "Like Loved One (our 8.75): both use Navy rum and Pineapple juice",
    ]);
  });

  it("falls back to Difford's rank", () => {
    const [bare] = suggestNext([d("bare", 12, false, null, [])]);
    expect(suggestionReasons(bare)).toEqual(["#12 on Difford's list"]);
  });

  it("drops bracketed notes from names", () => {
    expect(shortIngredientName("aged-jamaican-rum")).toBe("Aged Jamaican rum");
  });
});
