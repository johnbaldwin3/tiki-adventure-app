import { describe, expect, it } from "vitest";
import seed from "../../seed-data/cocktails.json";
import {
  drinkAvailability,
  normalizeBottle,
  planCabinetSave,
  requiredIngredientIds,
  summarizeCabinet,
  unrecognisedLines,
  type CabinetDrink,
} from "./cabinet";

const drinks: CabinetDrink[] = (seed as { name: string; diffordsRank: number; tried: boolean; ingredients: { ingredient: string }[] }[]).map(
  (c) => ({
    slug: c.name.toLowerCase(),
    name: c.name,
    diffordsRank: c.diffordsRank,
    tried: c.tried,
    ingredientTexts: c.ingredients.map((i) => i.ingredient),
  })
);
const byName = (n: string) => drinks.find((d) => d.name === n)!;

describe("requiredIngredientIds", () => {
  it("skips staples and (optional) lines", () => {
    // Painkiller: navy rum, pineapple juice, orange juice (staple), cream of coconut, Daiquiri bitters (optional)
    expect([...requiredIngredientIds(byName("Painkiller").ingredientTexts)].sort()).toEqual(
      ["cream-of-coconut", "navy-rum", "pineapple-juice"].sort()
    );
  });

  it("treats an ingredient as required if any line needs it", () => {
    expect([...requiredIngredientIds(["Saline solution (optional)", "Navy rum (ideally 54.5% alc./vol.)", "Dark/black/blackstrap rum (optional)", "Dark/black/blackstrap rum"])].sort()).toEqual(
      ["dark-rum", "navy-rum"]
    );
  });

  it("ignores wording the catalog doesn't know", () => {
    expect(requiredIngredientIds(["Unicorn tears"]).size).toBe(0);
  });
});

describe("drinkAvailability", () => {
  it("lists what's missing", () => {
    const pk = byName("Painkiller");
    expect(drinkAvailability(pk, new Set(["navy-rum"])).missing.sort()).toEqual(["cream-of-coconut", "pineapple-juice"]);
    expect(drinkAvailability(pk, new Set(["navy-rum", "pineapple-juice", "cream-of-coconut"])).missing).toEqual([]);
  });
});

describe("summarizeCabinet", () => {
  it("finds ready drinks, one-away drinks, and the best next bottle", () => {
    const have = new Set(["navy-rum", "pineapple-juice"]);
    const s = summarizeCabinet(drinks, have);
    expect(s.ready).toEqual([]);
    expect(s.oneAway.map((o) => [o.drink.name, o.missingId])).toContainEqual(["Painkiller", "cream-of-coconut"]);
    expect(s.buyNext[0].unlocks.length).toBeGreaterThanOrEqual(s.buyNext[s.buyNext.length - 1].unlocks.length);
    // Every one-away drink appears under exactly one buy-next bottle.
    expect(s.buyNext.reduce((n, b) => n + b.unlocks.length, 0)).toBe(s.oneAway.length);
  });

  it("with an empty cabinet, only staple-only drinks are ready", () => {
    const s = summarizeCabinet(drinks, new Set());
    for (const d of s.ready) expect(requiredIngredientIds(d.ingredientTexts).size).toBe(0);
  });

  it("with everything, all 100 are ready, sorted by Difford's rank", () => {
    const all = new Set(drinks.flatMap((d) => [...requiredIngredientIds(d.ingredientTexts)]));
    const s = summarizeCabinet(drinks, all);
    expect(s.ready).toHaveLength(100);
    expect(s.ready.map((d) => d.diffordsRank)).toEqual([...s.ready.map((d) => d.diffordsRank)].sort((a, b) => a - b));
    expect(s.oneAway).toEqual([]);
  });
});

describe("normalizeBottle", () => {
  it.each([
    ["  Smith  &  Cross ", "Smith & Cross"],
    ["", null],
    ["   ", null],
    [undefined, null],
    [42, null],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeBottle(input)).toBe(expected);
  });
  it("caps length at 120", () => {
    expect(normalizeBottle("x".repeat(200))).toHaveLength(120);
  });
});

describe("normalizeBottle length", () => {
  it("never cuts an emoji in half", () => {
    const v = normalizeBottle("a".repeat(119) + "🍹🍹");
    expect(v).toBe("a".repeat(119) + "🍹");
    expect(Array.from(v!)).toHaveLength(120);
  });
  it("trims a space left at the cut", () => {
    expect(normalizeBottle("a".repeat(119) + " b")).toBe("a".repeat(119));
  });
});

function fd(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}
const listed = (id: string) => ["navy-rum", "falernum", "orgeat"].includes(id);

describe("planCabinetSave", () => {
  it("writes only what this person changed", () => {
    const plan = planCabinetSave(
      fd([
        ["was", "navy-rum"], ["was-bottle:navy-rum", "Pusser's"],
        ["was", "orgeat"], ["was-bottle:orgeat", ""],
        ["have", "navy-rum"], ["bottle:navy-rum", "Pusser's"],
        ["have", "falernum"], ["bottle:falernum", "  John D. Taylor's  "],
      ]),
      listed
    );
    expect(plan.upsert).toEqual([{ ingredientId: "falernum", bottle: "John D. Taylor's" }]);
    expect(plan.remove).toEqual(["orgeat"]);
  });

  it("updates a kept row only when its bottle changed", () => {
    const plan = planCabinetSave(
      fd([["was", "navy-rum"], ["was-bottle:navy-rum", "Pusser's"], ["have", "navy-rum"], ["bottle:navy-rum", ""]]),
      listed
    );
    expect(plan.upsert).toEqual([{ ingredientId: "navy-rum", bottle: null }]);
    expect(plan.remove).toEqual([]);
  });

  it("ignores unknown, staple or duplicate ids", () => {
    const plan = planCabinetSave(
      fd([["have", "lime-juice"], ["have", "nope"], ["have", "navy-rum"], ["have", "navy-rum"], ["was", "../x"]]),
      listed
    );
    expect(plan.upsert).toEqual([{ ingredientId: "navy-rum", bottle: null }]);
    expect(plan.remove).toEqual([]);
  });
});

describe("unrecognised recipe lines", () => {
  it("keep a drink off the ready list", () => {
    const d = { slug: "x", name: "X", diffordsRank: 1, tried: false, ingredientTexts: ["Mystery bitters", "Pineapple juice"] };
    expect(drinkAvailability(d, new Set(["pineapple-juice"])).unknown).toEqual(["Mystery bitters"]);
    expect(summarizeCabinet([d], new Set(["pineapple-juice"])).ready).toEqual([]);
  });
  it("don't count when optional", () => {
    expect(unrecognisedLines(["Mystery bitters (optional)"])).toEqual([]);
  });
});
