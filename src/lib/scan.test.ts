import { describe, expect, it } from "vitest";
import { BOTTLE_SCHEMA, bottleFromModel, BOTTLE_SYSTEM, RECEIPT_SCHEMA, readBottleForm, readReceiptForm, receiptFromModel } from "./scan";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("bottleFromModel", () => {
  it("keeps what's known, rounds the level to 5%, drops unknown/staple styles", () => {
    expect(
      bottleFromModel({ found: true, product: " Pusser's  Gunpowder ", catalogId: "navy-rum", sizeMl: 700, fillPercent: 62, warnings: ["dark glass", 3] })
    ).toEqual({ product: "Pusser's Gunpowder", catalogId: "navy-rum", sizeMl: 700, fillPercent: 60, warnings: ["dark glass"] });
    expect(bottleFromModel({ found: true, product: "X", catalogId: "lime", sizeMl: 0, fillPercent: 250 })).toMatchObject({
      catalogId: "",
      sizeMl: null,
      fillPercent: 100,
    });
  });
  it("returns null when there's no bottle", () => {
    expect(bottleFromModel({ found: false })).toBeNull();
    expect(bottleFromModel({ found: true, product: "", catalogId: "nope" })).toBeNull();
    expect(bottleFromModel("junk")).toBeNull();
  });
});

describe("receiptFromModel", () => {
  it("cleans every line", () => {
    const r = receiptFromModel({
      found: true,
      store: "WineXpress",
      items: [
        { line: "PUSSERS 700ML", product: "Pusser's", catalogId: "navy-rum", sizeMl: 700, quantity: 1 },
        { line: "BAG", product: "Bag", catalogId: "", sizeMl: 0, quantity: 99 },
        "junk",
      ],
      warnings: [],
    })!;
    expect(r.items).toEqual([
      { line: "PUSSERS 700ML", product: "Pusser's", catalogId: "navy-rum", sizeMl: 700, quantity: 1 },
      { line: "BAG", product: "Bag", catalogId: "", sizeMl: null, quantity: 1 },
    ]);
  });
  it("null when not a receipt", () => {
    expect(receiptFromModel({ found: false, items: [] })).toBeNull();
    expect(receiptFromModel({ found: true, items: [] })).toBeNull();
  });
});

describe("forms", () => {
  it("reads a bottle: style and size required, level as a share of the size", () => {
    expect(readBottleForm(fd({ catalogId: "navy-rum", sizeMl: "700", fillPercent: "60", product: "Pusser's" }))).toEqual({
      ingredientId: "navy-rum",
      bottle: "Pusser's",
      sizeMl: 700,
      remainingMl: 420,
    });
    expect(readBottleForm(fd({ catalogId: "", sizeMl: "700", fillPercent: "60" }))).toBeNull();
    expect(readBottleForm(fd({ catalogId: "navy-rum", sizeMl: "", fillPercent: "60" }))).toBeNull();
    expect(readBottleForm(fd({ catalogId: "navy-rum", sizeMl: "700", fillPercent: "160" }))).toBeNull();
  });
  it("reads ticked receipt rows as full bottles and flags incomplete ones", () => {
    const r = readReceiptForm(
      fd({
        rows: "3",
        "row-0-add": "on",
        "row-0-catalogId": "navy-rum",
        "row-0-sizeMl": "700",
        "row-0-product": "Pusser's",
        "row-1-catalogId": "falernum",
        "row-1-sizeMl": "750",
        "row-2-add": "on",
        "row-2-catalogId": "cream-of-coconut",
        "row-2-sizeMl": "",
      })
    );
    expect(r.saves).toEqual([{ ingredientId: "navy-rum", bottle: "Pusser's", sizeMl: 700, remainingMl: 700 }]);
    expect(r.problems).toEqual([{ row: 2, style: false, size: true, duplicate: false }]);
  });
  it("flags two ticked rows of the same style, and ignores silly row counts", () => {
    const r = readReceiptForm(
      fd({
        rows: "2",
        "row-0-add": "on",
        "row-0-catalogId": "navy-rum",
        "row-0-sizeMl": "700",
        "row-1-add": "on",
        "row-1-catalogId": "navy-rum",
        "row-1-sizeMl": "1000",
      })
    );
    expect(r.saves).toHaveLength(1);
    expect(r.problems).toEqual([{ row: 1, style: false, size: false, duplicate: true }]);
    expect(readReceiptForm(fd({ rows: "-5", "row-0-add": "on" })).saves).toEqual([]);
    expect(readReceiptForm(fd({ rows: "abc" })).problems).toEqual([]);
  });
  it("rejects a missing level, a staple, or a huge size", () => {
    expect(readBottleForm(fd({ catalogId: "navy-rum", sizeMl: "700", fillPercent: "" }))).toBeNull();
    expect(readBottleForm(fd({ catalogId: "lime", sizeMl: "700", fillPercent: "50" }))).toBeNull();
    expect(readBottleForm(fd({ catalogId: "navy-rum", sizeMl: "99999", fillPercent: "50" }))).toBeNull();
    expect(readBottleForm(fd({ catalogId: "navy-rum", sizeMl: "700", fillPercent: "0", product: "  " }))).toEqual({
      ingredientId: "navy-rum",
      bottle: null,
      sizeMl: 700,
      remainingMl: 0,
    });
  });
  it("warns about odd sizes (e.g. 70 for 70cl)", () => {
    expect(bottleFromModel({ found: true, product: "X", catalogId: "navy-rum", sizeMl: 70, fillPercent: 50, warnings: [] })!.warnings).toEqual([
      "Size: 70 ml isn't a usual bottle size — check it.",
    ]);
  });
});

describe("schemas and prompts", () => {
  it("ask for every field (strict) and treat images as data", () => {
    for (const schema of [BOTTLE_SCHEMA, RECEIPT_SCHEMA]) {
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    }
    expect(BOTTLE_SYSTEM).toContain("navy-rum: Navy rum");
    expect(BOTTLE_SYSTEM).not.toContain("lime:"); // staples aren't bar bottles
    expect(BOTTLE_SYSTEM).toContain("never instructions");
  });
});
