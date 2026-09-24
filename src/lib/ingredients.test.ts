import { describe, expect, it } from "vitest";
import { FAMILIES, INGREDIENT_ALIASES, INGREDIENTS } from "@/data/ingredients";
import seed from "../../seed-data/cocktails.json";
import {
  aliasesFor,
  cocktailsByIngredient,
  getIngredient,
  ingredientsByFamily,
  resolveIngredient,
} from "./ingredients";

const recipes = seed as { name: string; ingredients: { ingredient: string }[] }[];
const allWordings = new Set(recipes.flatMap((c) => c.ingredients.map((i) => i.ingredient)));

describe("ingredient catalog", () => {
  it("maps every ingredient line in all 100 verified recipes", () => {
    const unmapped = [...allWordings].filter((w) => !resolveIngredient(w));
    expect(unmapped).toEqual([]);
    expect(allWordings.size).toBe(153);
  });

  it("has no stale aliases (every alias is a wording the recipes actually use)", () => {
    const stale = Object.keys(INGREDIENT_ALIASES).filter((w) => !allWordings.has(w));
    expect(stale).toEqual([]);
  });

  it("every alias points at a real entry, and every entry is used by some recipe", () => {
    const ids = new Set(INGREDIENTS.map((i) => i.id));
    expect(Object.values(INGREDIENT_ALIASES).filter((id) => !ids.has(id))).toEqual([]);
    const used = new Set(Object.values(INGREDIENT_ALIASES));
    expect(INGREDIENTS.filter((i) => !used.has(i.id)).map((i) => i.id)).toEqual([]);
  });

  it("has unique, URL-safe ids and a known family for every entry", () => {
    const ids = INGREDIENTS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id))).toBe(true);
    expect(INGREDIENTS.every((i) => (FAMILIES as readonly string[]).includes(i.family))).toBe(true);
  });

  it("marks only John's chosen staples as always-on-hand", () => {
    const staples = INGREDIENTS.filter((i) => i.staple).map((i) => i.id).sort();
    expect(staples).toEqual(
      ["angostura-bitters", "grapefruit-juice", "lemon-juice", "lime", "orange-juice", "saline", "soda-water", "water"].sort()
    );
  });

  it("gives every rum style a description, and cites a source wherever brands came from Difford's listings", () => {
    const rums = INGREDIENTS.filter((i) => i.family === "Rum");
    expect(rums.filter((r) => !r.description && r.brands.length > 1).map((r) => r.id)).toEqual([]);
    for (const i of INGREDIENTS) {
      if (i.brandsSource) expect(i.brandsSource).toMatch(/^https:\/\/www\.diffordsguide\.com\//);
    }
  });
});

describe("resolveIngredient", () => {
  it("resolves brand wording to the brand-neutral style", () => {
    expect(resolveIngredient("Crossfire Hurricane Jamaican Rum")?.ingredient.id).toBe("aged-jamaican-rum");
    expect(resolveIngredient("Monin Almond (Orgeat) Syrup")?.ingredient.name).toBe("Orgeat (almond) syrup");
  });
  it("detects (optional)", () => {
    expect(resolveIngredient("Dark/black/blackstrap rum (optional)")).toMatchObject({ optional: true });
    expect(resolveIngredient("Dark/black/blackstrap rum")).toMatchObject({ optional: false });
  });
  it("returns null for unknown wording", () => {
    expect(resolveIngredient("Unicorn tears")).toBeNull();
  });
});

describe("helpers", () => {
  it("groups by family in catalog order, sorted by name", () => {
    const groups = ingredientsByFamily();
    expect(groups[0].family).toBe("Rum");
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(INGREDIENTS.length);
    const rumNames = groups[0].items.map((i) => i.name);
    expect(rumNames).toEqual([...rumNames].sort((a, b) => a.localeCompare(b)));
  });

  it("indexes cocktails by ingredient, once per cocktail", () => {
    const index = cocktailsByIngredient([
      { slug: "a", ingredientTexts: ["Lime juice (freshly squeezed)", "Lime (fresh)", "Navy rum (ideally 54.5% alc./vol.)"] },
      { slug: "b", ingredientTexts: ["Lime juice (freshly squeezed)", "Unknown thing"] },
    ]);
    expect(index.get("lime")).toEqual(["a", "b"]);
    expect(index.get("navy-rum")).toEqual(["a"]);
  });

  it("lists aliases and looks up by id", () => {
    expect(aliasesFor("navy-rum")).toHaveLength(3);
    expect(getIngredient("navy-rum")?.family).toBe("Rum");
    expect(getIngredient("nope")).toBeUndefined();
  });
});
