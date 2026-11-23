import { describe, expect, it } from "vitest";
import { mapRowsToCocktailRecords } from "./cocktails";
import { mapVersions, type RawVersionRow } from "./versions";

const row = (over: Partial<RawVersionRow>): RawVersionRow => ({
  id: "v1",
  cocktail_id: "c1",
  status: "trial",
  ingredients: [{ amount: "20", unit: "ml", ingredient: "Bitter Campari", catalog_id: "italian-red-bitter" }],
  method_summary: null,
  critique: "Too bitter",
  reasoning: null,
  created_by: "taster-jb",
  created_at: "2026-10-01T00:00:00Z",
  decided_at: null,
  ...over,
});

describe("mapVersions", () => {
  it("groups a drink's trial and active versions", () => {
    const m = mapVersions([row({}), row({ id: "v2", status: "active" }), row({ id: "v3", cocktail_id: "c2", status: "retired" })]);
    expect(m.get("c1")!.trial!.id).toBe("v1");
    expect(m.get("c1")!.active!.id).toBe("v2");
    expect(m.get("c1")!.trial!.ingredients[0]).toEqual({ amount: "20", unit: "ml", ingredient: "Bitter Campari", catalogId: "italian-red-bitter" });
    expect(m.has("c2")).toBe(false);
  });
  it("skips versions with no usable ingredients", () => {
    expect(mapVersions([row({ ingredients: "junk" })]).size).toBe(0);
  });
});

describe("our version in the list", () => {
  it("replaces the original's lines for bar, search and styles", () => {
    const cocktails = [
      {
        id: "c1",
        name: "Negroni",
        slug: "negroni",
        diffords_rank: null,
        diffords_guide_url: null,
        primary_spirits: ["Gin"],
        ingredients: [{ amount: "30", unit: "ml", ingredient: "Bitter Campari", catalog_id: "italian-red-bitter" }],
        source: "iba",
      },
    ];
    const [plain] = mapRowsToCocktailRecords(cocktails, []);
    expect(plain.ingredientTexts).toEqual(["Bitter Campari"]);
    const ours = new Map([["c1", [{ amount: "1", unit: "dash", ingredient: "Orange bitters", catalogId: "orange-bitters" }]]]);
    const [tweaked] = mapRowsToCocktailRecords(cocktails, [], new Map(), new Map(), ours);
    expect(tweaked.ingredientTexts).toEqual(["Orange bitters"]);
    expect(tweaked.ingredientIds).toEqual(["orange-bitters"]);
  });
});
