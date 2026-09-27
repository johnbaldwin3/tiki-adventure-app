import { describe, expect, it } from "vitest";
import { describeLeft, fractionLeft, isLow, lowThresholdMl, parseLevel, parseSize, pourLines } from "./inventory";

describe("pourLines", () => {
  const painkiller = [
    { amount: "1 1/2", unit: "fl oz", ingredient: "Navy rum (ideally circa 55% alc./vol.)" },
    { amount: "3", unit: "fl oz", ingredient: "Pineapple juice" },
    { amount: "3/4", unit: "fl oz", ingredient: "Orange juice (freshly squeezed)" },
    { amount: "1/2", unit: "fl oz", ingredient: "Cream of coconut (e.g. Coco Lopez, Re'al etc.)" },
    { amount: "4", unit: "drop", ingredient: "Difford's Daiquiri Bitters (optional)" },
  ];

  it("measures what's poured, per style, for the servings (not staples, optional or counted lines)", () => {
    expect(pourLines(painkiller, 2)).toEqual([
      { ingredientId: "navy-rum", ml: 90 },
      { ingredientId: "pineapple-juice", ml: 180 },
      { ingredientId: "cream-of-coconut", ml: 30 },
    ]);
  });

  it("adds up two lines of the same style, uses explicit catalog ids, and skips what it can't read", () => {
    expect(
      pourLines(
        [
          { amount: "1", unit: "fl oz", ingredient: "House rum", catalogId: "navy-rum" },
          { amount: "15", unit: "ml", ingredient: "Other navy", catalogId: "navy-rum" },
          { amount: "Top up", unit: "", ingredient: "Soda", catalogId: "navy-rum" },
          { amount: "1-2", unit: "fl oz", ingredient: "Falernum liqueur" },
          { amount: "1/4", unit: "barspoon", ingredient: "Xanthan", catalogId: "xanthan-gum" },
        ],
        1
      )
    ).toEqual([
      { ingredientId: "navy-rum", ml: 45 },
      { ingredientId: "falernum", ml: 45 },
    ]);
  });
});

describe("levels", () => {
  it("knows when a bottle is running low", () => {
    expect(lowThresholdMl(750)).toBe(150);
    expect(lowThresholdMl(50)).toBe(25);
    expect(lowThresholdMl(null)).toBe(60);
    expect(isLow({ sizeMl: 750, remainingMl: 150 })).toBe(true);
    expect(isLow({ sizeMl: 750, remainingMl: 151 })).toBe(false);
    expect(isLow({ sizeMl: null, remainingMl: 45 })).toBe(true);
    expect(isLow({ sizeMl: 750, remainingMl: null })).toBe(false);
  });
  it("describes what's left", () => {
    expect(describeLeft({ sizeMl: 750, remainingMl: 210 })).toBe("about 210 ml (7 fl oz) left");
    expect(describeLeft({ sizeMl: 750, remainingMl: 0 })).toBe("empty");
    expect(describeLeft({ sizeMl: 750, remainingMl: null })).toBeNull();
    expect(fractionLeft({ sizeMl: 700, remainingMl: 350 })).toBe(0.5);
    expect(fractionLeft({ sizeMl: null, remainingMl: 350 })).toBeNull();
  });
  it("validates form input", () => {
    expect(parseSize("750")).toBe(750);
    expect(parseSize("5")).toBeNull();
    expect(parseSize("abc")).toBeNull();
    expect(parseLevel("0.5")).toBe(0.5);
    expect(parseLevel("2")).toBeNull();
    expect(parseLevel("")).toBeNull();
  });
});

describe("edge cases", () => {
  it("small amounts and big bottles", () => {
    expect(describeLeft({ sizeMl: 750, remainingMl: 3 })).toBe("a few drops left");
    expect(describeLeft({ sizeMl: 750, remainingMl: 7 })).toBe("about 5 ml (1/4 fl oz) left");
    expect(lowThresholdMl(1750)).toBe(350);
    expect(lowThresholdMl(100)).toBe(50);
  });
  it("measures cl, tsp and litres, and big batches, to 0.1 ml", () => {
    expect(
      pourLines(
        [
          { amount: "4.5", unit: "cl", ingredient: "x", catalogId: "navy-rum" },
          { amount: "1", unit: "tsp", ingredient: "y", catalogId: "falernum" },
          { amount: "1/24", unit: "fl oz", ingredient: "z", catalogId: "orgeat-syrup" },
        ],
        12
      )
    ).toEqual([
      { ingredientId: "navy-rum", ml: 540 },
      { ingredientId: "falernum", ml: 60 },
      { ingredientId: "orgeat-syrup", ml: 15 },
    ]);
  });
});
