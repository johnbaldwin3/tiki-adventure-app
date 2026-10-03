import { describe, expect, it } from "vitest";
import seed from "../../seed-data/cocktails.json";
import iba from "../../seed-data/iba-cocktails.json";
import {
  applyStyleOverrides,
  computeStyles,
  getStyleTag,
  matchesStyles,
  overridesFor,
  parseStyleFilter,
  STYLE_TAGS,
  type StyleLine,
} from "./styles";

const all = [...(seed as { name: string; ingredients: StyleLine[] }[]), ...(iba.cocktails as { name: string; ingredients: StyleLine[] }[])];
const tagsOf = (name: string) => computeStyles(all.find((c) => c.name === name)!.ingredients);

describe("computeStyles on the verified recipes", () => {
  it("gives every drink exactly one structure", () => {
    for (const c of all) {
      const tags = computeStyles(c.ingredients);
      expect(tags.filter((t) => getStyleTag(t)!.group === "structure"), c.name).toHaveLength(1);
    }
  });

  it.each([
    ["Negroni", ["spirit-forward", "gin", "bitter"]],
    ["Dry Martini", ["spirit-forward", "gin"]],
    ["Manhattan", ["spirit-forward", "whiskey"]],
    ["Daiquiri", ["sour", "rum"]],
    ["Margarita", ["sour", "agave"]],
    ["Moscow Mule", ["highball", "vodka", "spiced"]],
    ["Cuba Libre", ["highball", "rum"]],
    ["French 75", ["sparkling", "gin"]],
    ["Spritz", ["sparkling", "low-abv", "bitter"]],
    ["Americano", ["aperitif", "low-abv", "bitter"]],
    ["Painkiller", ["creamy", "rum", "fruity"]],
    ["Pina Colada", ["creamy", "rum", "fruity"]],
    ["Bloody Mary", ["juice-led", "vodka", "spiced"]],
    ["Naked and Famous", ["sour", "agave", "bitter", "smoky", "herbal"]],
    ["Espresso Martini", ["spirit-forward", "vodka", "coffee-chocolate"]],
    ["Mai Tai (Trader Vic's)", ["sour", "rum", "nutty"]],
    // 4 dashes of absinthe are an accent, not "herbal".
    ["Zombie", ["sour", "rum", "spiced", "fruity"]],
    ["Sazerac", ["spirit-forward", "brandy", "herbal"]],
    // A splash of juice doesn't make a drink juice-led.
    ["French Martini", ["spirit-forward", "vodka", "fruity"]],
    // Two small mixers that add up to a long drink.
    ["Rum Fruit Cup (Difford's Cup No.4)", ["highball", "rum"]],
    // A big pour of Angostura is the base, and it's bitter.
    ["Trinidad Sour", ["sour", "whiskey", "bitter", "nutty"]],
    // Champagne served on the side isn't in the drink; orange wheels aren't fruit.
    ["Porn Star Martini", ["juice-led", "vodka", "fruity"]],
    ["Sherry Cobbler", ["aperitif", "low-abv"]],
    // High-proof Chartreuse: not lower-alcohol even with no base spirit.
    ["Chartreuse Swizzle", ["sour", "liqueur-led", "herbal", "spiced", "fruity"]],
  ])("%s", (name, expected) => {
    expect(tagsOf(name)).toEqual(expected);
  });

  it("ignores lines the catalog doesn't know", () => {
    expect(computeStyles([{ amount: "2", unit: "fl oz", ingredient: "Mystery spirit" }])).toEqual(["aperitif", "low-abv"]);
    expect(computeStyles([{ amount: "2", unit: "fl oz", ingredient: "Anything", catalogId: "london-dry-gin" }])).toEqual([
      "spirit-forward",
      "gin",
    ]);
  });
});

describe("taster fixes", () => {
  it("round-trips: the overrides for a chosen set reproduce it", () => {
    const computed = tagsOf("Negroni");
    const chosen = ["spirit-forward", "gin", "bitter", "herbal"];
    const o = overridesFor(computed, chosen);
    expect(o).toEqual([{ tag: "herbal", include: true }]);
    expect(applyStyleOverrides(computed, o)).toEqual(chosen);
    expect(overridesFor(computed, ["gin"])).toEqual([
      { tag: "spirit-forward", include: false },
      { tag: "bitter", include: false },
    ]);
    expect(overridesFor(computed, computed)).toEqual([]);
  });

  it("ignores unknown tags", () => {
    expect(applyStyleOverrides(["gin"], [{ tag: "bogus", include: true }])).toEqual(["gin"]);
    expect(overridesFor(["gin"], ["gin", "bogus"])).toEqual([]);
  });
});

describe("style filter", () => {
  it("reads ?style= leniently and matches all-of", () => {
    expect(parseStyleFilter("sour,gin,bogus,sour")).toEqual(["sour", "gin"]);
    expect(parseStyleFilter(["sour", "smoky"])).toEqual(["sour", "smoky"]);
    expect(parseStyleFilter(undefined)).toEqual([]);
    expect(matchesStyles(["sour", "gin"], ["gin"])).toBe(true);
    expect(matchesStyles(["sour", "gin"], ["gin", "smoky"])).toBe(false);
    expect(matchesStyles(undefined, [])).toBe(true);
  });

  it("has unique, URL-safe tag ids that fit the DB check", () => {
    const ids = STYLE_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
