import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "@/data/ingredients";
import { getIngredient } from "./ingredients";
import { getSpiritGroup, groupMembers, hasIngredientOrGroup, SPIRIT_GROUPS } from "./spirit-groups";

describe("spirit groups", () => {
  it("never clash with a catalog ingredient id", () => {
    for (const g of SPIRIT_GROUPS) expect(getIngredient(g.id), g.id).toBeUndefined();
  });

  it("cover every bottle of their families, and nothing else", () => {
    const rum = groupMembers("any-rum");
    expect(rum.has("aged-jamaican-rum")).toBe(true);
    expect(rum.has("london-dry-gin")).toBe(false);
    for (const g of SPIRIT_GROUPS) {
      const expected = INGREDIENTS.filter((i) => g.families.includes(i.family)).map((i) => i.id);
      expect([...groupMembers(g.id)].sort(), g.id).toEqual(expected.sort());
      expect(expected.length, g.id).toBeGreaterThan(0);
    }
  });

  it("matches a plain id or any member of a group", () => {
    const ids = new Set(["aged-jamaican-rum", "lime"]);
    expect(hasIngredientOrGroup(ids, "lime")).toBe(true);
    expect(hasIngredientOrGroup(ids, "any-rum")).toBe(true);
    expect(hasIngredientOrGroup(ids, "any-vodka")).toBe(false);
    expect(hasIngredientOrGroup(ids, "falernum")).toBe(false);
    expect(getSpiritGroup("any-rum")?.label).toMatch(/rum/i);
    expect(groupMembers("lime").size).toBe(0);
  });
});
