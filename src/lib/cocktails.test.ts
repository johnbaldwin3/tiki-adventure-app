import { describe, expect, it } from "vitest";
import { mapRowsToCocktailRecords } from "./cocktails";

describe("mapRowsToCocktailRecords", () => {
  it("joins tastings onto their cocktail by taster initials, sorted by diffords_rank", () => {
    const cocktailRows = [
      {
        id: "c2",
        name: "Painkiller",
        diffords_rank: 7,
        diffords_guide_url: "https://example.com/painkiller",
        primary_spirits: ["Rum"],
      },
      {
        id: "c1",
        name: "Tiki Max",
        diffords_rank: 13,
        diffords_guide_url: "https://example.com/tiki-max",
        primary_spirits: ["Rum", "Amaro"],
      },
    ];
    const tastingRows = [
      { cocktail_id: "c1", rating: null, tried: true, tasters: { initials: "JB" } },
      { cocktail_id: "c1", rating: 9.41, tried: true, tasters: { initials: "GM" } },
      { cocktail_id: "c2", rating: 8.59, tried: true, tasters: { initials: "JB" } },
    ];

    const records = mapRowsToCocktailRecords(cocktailRows, tastingRows);

    // Sorted by diffords_rank ascending (Painkiller #7 before Tiki Max #13).
    expect(records.map((r) => r.name)).toEqual(["Painkiller", "Tiki Max"]);

    const tikiMax = records.find((r) => r.name === "Tiki Max")!;
    expect(tikiMax.jbRating).toBeNull();
    expect(tikiMax.gmRating).toBe(9.41);
    expect(tikiMax.tried).toBe(true);
    expect(tikiMax.primarySpirits).toEqual(["Rum", "Amaro"]);
    expect(tikiMax.diffordsGuideUrl).toBe("https://example.com/tiki-max");

    const painkiller = records.find((r) => r.name === "Painkiller")!;
    expect(painkiller.jbRating).toBe(8.59);
    expect(painkiller.gmRating).toBeNull();
  });

  it("marks a cocktail untried and unrated when it has no tastings row", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "Untasted Drink",
        diffords_rank: 42,
        diffords_guide_url: "https://example.com/untasted",
        primary_spirits: ["Gin"],
      },
    ];

    const records = mapRowsToCocktailRecords(cocktailRows, []);

    expect(records).toHaveLength(1);
    expect(records[0].tried).toBe(false);
    expect(records[0].jbRating).toBeNull();
    expect(records[0].gmRating).toBeNull();
  });

  it("defaults primary_spirits to an empty array when null", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "Mystery Drink",
        diffords_rank: 1,
        diffords_guide_url: "https://example.com/mystery",
        primary_spirits: null,
      },
    ];

    const records = mapRowsToCocktailRecords(cocktailRows, []);

    expect(records[0].primarySpirits).toEqual([]);
  });

  it("handles the tasters relation coming back as an array instead of an object", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "Array Relation Drink",
        diffords_rank: 1,
        diffords_guide_url: "https://example.com/array",
        primary_spirits: [],
      },
    ];
    const tastingRows = [
      { cocktail_id: "c1", rating: 7.5, tried: true, tasters: [{ initials: "JB" }] },
    ];

    const records = mapRowsToCocktailRecords(cocktailRows, tastingRows);

    expect(records[0].jbRating).toBe(7.5);
  });

  it("ignores a tastings row with no resolvable taster", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "Orphan Tasting Drink",
        diffords_rank: 1,
        diffords_guide_url: "https://example.com/orphan",
        primary_spirits: [],
      },
    ];
    const tastingRows = [{ cocktail_id: "c1", rating: 5, tried: true, tasters: null }];

    const records = mapRowsToCocktailRecords(cocktailRows, tastingRows);

    expect(records[0].jbRating).toBeNull();
    expect(records[0].gmRating).toBeNull();
    // tried stays false: the only tastings row for this cocktail had no
    // resolvable taster, so it was skipped entirely rather than counted.
    expect(records[0].tried).toBe(false);
  });
});
