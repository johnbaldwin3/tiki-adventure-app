import { describe, expect, it } from "vitest";
import { mapRowsToCocktailDetail, mapRowsToCocktailRecords, parseIngredients } from "./cocktails";

describe("mapRowsToCocktailRecords", () => {
  it("joins tastings onto their cocktail by taster initials, sorted by diffords_rank", () => {
    const cocktailRows = [
      {
        id: "c2",
        name: "Painkiller",
        slug: "painkiller",
        diffords_rank: 7,
        diffords_guide_url: "https://example.com/painkiller",
        primary_spirits: ["Rum"],
      },
      {
        id: "c1",
        name: "Tiki Max",
        slug: "tiki-max",
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
    expect(tikiMax.slug).toBe("tiki-max");

    const painkiller = records.find((r) => r.name === "Painkiller")!;
    expect(painkiller.jbRating).toBe(8.59);
    expect(painkiller.gmRating).toBeNull();
  });

  it("marks a cocktail untried and unrated when it has no tastings row", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "Untasted Drink",
        slug: "untasted-drink",
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
        slug: "mystery-drink",
        diffords_rank: 1,
        diffords_guide_url: "https://example.com/mystery",
        primary_spirits: null,
      },
    ];

    const records = mapRowsToCocktailRecords(cocktailRows, []);

    expect(records[0].primarySpirits).toEqual([]);
  });

  it("coerces a string-typed rating (how Postgres numeric columns actually come back via PostgREST) to a number", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "String Rating Drink",
        slug: "string-rating-drink",
        diffords_rank: 1,
        diffords_guide_url: "https://example.com/string-rating",
        primary_spirits: [],
      },
    ];
    const tastingRows = [
      { cocktail_id: "c1", rating: "8.59", tried: true, tasters: { initials: "JB" } },
      { cocktail_id: "c1", rating: "9.41", tried: true, tasters: { initials: "GM" } },
    ];

    const records = mapRowsToCocktailRecords(cocktailRows, tastingRows);

    expect(records[0].jbRating).toBe(8.59);
    expect(records[0].gmRating).toBe(9.41);
    expect(typeof records[0].jbRating).toBe("number");
  });

  it("handles the tasters relation coming back as an array instead of an object", () => {
    const cocktailRows = [
      {
        id: "c1",
        name: "Array Relation Drink",
        slug: "array-relation-drink",
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
        slug: "orphan-tasting-drink",
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

describe("parseIngredients", () => {
  it("keeps well-formed entries in order and drops malformed ones", () => {
    expect(
      parseIngredients([
        { amount: "1 1/2", unit: "fl oz", ingredient: "Rum" },
        null,
        { amount: 2, unit: "dash", ingredient: "Bitters" },
        { amount: "1", unit: "fl oz" },
        "junk",
        { ingredient: "Mint sprig" },
        { amount: "1", unit: "fl oz", ingredient: "   " },
        { amount: { bad: true }, unit: "fl oz", ingredient: "Lime juice" },
      ])
    ).toEqual([
      { amount: "1 1/2", unit: "fl oz", ingredient: "Rum" },
      { amount: "2", unit: "dash", ingredient: "Bitters" },
      { amount: "", unit: "", ingredient: "Mint sprig" },
      { amount: "", unit: "fl oz", ingredient: "Lime juice" },
    ]);
  });
  it("returns [] for a non-array value", () => {
    expect(parseIngredients(null)).toEqual([]);
    expect(parseIngredients({})).toEqual([]);
  });
});

describe("mapRowsToCocktailDetail", () => {
  const cocktailRow = {
    id: "c1",
    name: "Tiki Max",
    slug: "tiki-max",
    diffords_rank: 13,
    diffords_guide_url: "https://example.com/tiki-max",
    primary_spirits: ["Navy Rum"],
    glass: "Tiki mug",
    garnish: "Mint sprig",
    method_summary: "Shake and strain.",
    ingredients: [{ amount: "1", unit: "fl oz", ingredient: "Navy rum" }],
  };
  const tasterRows = [
    { id: "t-gm", initials: "GM", display_name: "Genny" },
    { id: "t-jb", initials: "JB", display_name: "John" },
  ];

  it("maps recipe fields and orders tasters JB then GM", () => {
    const detail = mapRowsToCocktailDetail(cocktailRow, tasterRows, [
      { taster_id: "t-gm", rating: "9.41", notes: "  Loved it  ", tried: true, tasted_at: "2026-06-01" },
      { taster_id: "t-jb", rating: null, notes: "", tried: true, tasted_at: null },
    ]);

    expect(detail.slug).toBe("tiki-max");
    expect(detail.glass).toBe("Tiki mug");
    expect(detail.methodSummary).toBe("Shake and strain.");
    expect(detail.ingredients).toHaveLength(1);
    expect(detail.tasters.map((t) => t.initials)).toEqual(["JB", "GM"]);

    const [jb, gm] = detail.tasters;
    expect(jb).toEqual({
      initials: "JB",
      displayName: "John",
      tried: true,
      rating: null,
      notes: null, // blank notes normalize to null
      tastedAt: null,
    });
    expect(gm.rating).toBe(9.41); // numeric string coerced
    expect(gm.notes).toBe("Loved it");
    expect(gm.tastedAt).toBe("2026-06-01");
  });

  it("includes a taster with no tastings row as untried and unrated", () => {
    const detail = mapRowsToCocktailDetail(cocktailRow, tasterRows, []);
    expect(detail.tasters).toHaveLength(2);
    expect(detail.tasters.every((t) => !t.tried && t.rating === null && t.notes === null)).toBe(true);
  });
});
