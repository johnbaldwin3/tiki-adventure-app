import { describe, expect, it } from "vitest";
import {
  collectionCounts,
  collectionProgress,
  collectionSlug,
  collectionSlugsByCocktail,
  inCollection,
  mapCollections,
  mapMemberships,
  parseCollection,
  planMembershipChange,
  readCollectionForm,
  readCollectionPicks,
  validateCollectionName,
  type Collection,
} from "./collections";

const cols: Collection[] = mapCollections([
  { id: "c3", slug: "prohibition", name: "Prohibition", description: null, sort_order: 3, built_in: true },
  { id: "c1", slug: "tiki", name: "Tiki", description: "Tiki drinks", sort_order: 1, built_in: true },
  { id: "c9", slug: "date-night", name: "Date night", description: null, sort_order: null, built_in: null },
  { id: "c2", slug: "classics", name: "Classics", description: null, sort_order: 2, built_in: true },
]);

describe("collections", () => {
  it("orders collections by sort order, then name, with defaults filled in", () => {
    expect(cols.map((c) => c.slug)).toEqual(["tiki", "classics", "prohibition", "date-night"]);
    expect(cols[3]).toEqual({ id: "c9", slug: "date-night", name: "Date night", description: null, sortOrder: 100, builtIn: false });
  });

  it("drops non-http note links", () => {
    const m = mapMemberships([
      { cocktail_id: "a", collection_id: "c1", note: "n", note_url: "javascript:alert(1)" },
      { cocktail_id: "b", collection_id: "c1", note_url: "https://example.com" },
    ]);
    expect(m.map((x) => x.noteUrl)).toEqual([null, "https://example.com"]);
    expect(m[1].note).toBeNull();
  });

  it("maps each drink to its collection slugs in collection order, ignoring unknown collections", () => {
    const by = collectionSlugsByCocktail(
      cols,
      mapMemberships([
        { cocktail_id: "d1", collection_id: "c3" },
        { cocktail_id: "d1", collection_id: "c1" },
        { cocktail_id: "d2", collection_id: "gone" },
      ])
    );
    expect(by.get("d1")).toEqual(["tiki", "prohibition"]);
    expect(by.has("d2")).toBe(false);
  });

  it("reads ?c= leniently", () => {
    expect(parseCollection("classics", cols)?.id).toBe("c2");
    expect(parseCollection(["tiki", "x"], cols)?.id).toBe("c1");
    expect(parseCollection("nope", cols)).toBeNull();
    expect(parseCollection(undefined, cols)).toBeNull();
  });

  it("filters, counts and reports progress per collection", () => {
    const records = [
      { name: "A", tried: true, collections: ["tiki"] },
      { name: "B", tried: false, collections: ["tiki", "classics"] },
      { name: "C", tried: false },
    ];
    expect(inCollection(records, cols[0]).map((r) => r.name)).toEqual(["A", "B"]);
    expect(inCollection(records, null)).toHaveLength(3);
    expect(Object.fromEntries(collectionCounts(records))).toEqual({ tiki: 2, classics: 1 });
    expect(collectionProgress(cols, records)).toEqual([
      { slug: "tiki", name: "Tiki", tried: 1, total: 2 },
      { slug: "classics", name: "Classics", tried: 0, total: 1 },
    ]);
  });

  it("validates names: required, unique (ignoring case), and not a reserved slug", () => {
    expect(validateCollectionName("", cols)).toBe("empty");
    expect(validateCollectionName("!!!", cols)).toBe("symbols");
    expect(validateCollectionName("tiki", cols)).toBe("taken");
    expect(validateCollectionName("Date-Night", cols)).toBe("taken"); // same link as "Date night"
    expect(validateCollectionName("All", cols)).toBe("reserved");
    expect(validateCollectionName("Stirred & Boozy", cols)).toBeNull();
    expect(collectionSlug("Stirred & Boozy")).toBe("stirred-and-boozy");
    expect(collectionSlug("x".repeat(60))).toHaveLength(40);
  });

  it("reads the collection form, trimmed and capped", () => {
    const f = new FormData();
    f.set("name", "  Date   night ");
    f.set("description", "d".repeat(400));
    expect(readCollectionForm(f)).toEqual({ name: "Date night", description: "d".repeat(300) });
  });

  it("keeps only real, distinct collection picks and plans the change", () => {
    const f = new FormData();
    for (const v of ["c1", "c2", "c1", "bogus"]) f.append("collection", v);
    expect(readCollectionPicks(f, cols)).toEqual(["c1", "c2"]);
    expect(planMembershipChange(["c1", "c3"], ["c1", "c2"])).toEqual({ add: ["c2"], remove: ["c3"] });
    // A collection the form didn't show (added since it loaded) is never removed.
    expect(planMembershipChange(["c1", "c3", "c9"], ["c1"], ["c1", "c3"])).toEqual({ add: [], remove: ["c3"] });
  });
});
