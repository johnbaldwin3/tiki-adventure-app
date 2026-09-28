import { describe, expect, it } from "vitest";
import { readRecipeForm, safeHttpUrl, toCocktailRow, uniqueSlug, validateRecipe, parseSpirits, emptyDraft } from "./recipe-form";

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("readRecipeForm", () => {
  it("reads rows in order, drops blank ones, trims and caps everything", () => {
    const d = readRecipeForm(
      fd({
        name: "  Test   Swizzle ",
        lines: "3",
        "line-0-amount": "2",
        "line-0-unit": "fl oz",
        "line-0-ingredient": " Navy rum ",
        "line-0-catalog": "navy-rum",
        "line-1-amount": "",
        "line-1-ingredient": "",
        "line-2-ingredient": "Mystery",
        "line-2-catalog": "made-up-id",
        method: "Shake.\r\n\r\n\r\n\r\nStrain.",
        sourceNote: "x".repeat(300),
      })
    );
    expect(d.name).toBe("Test Swizzle");
    expect(d.ingredients).toEqual([
      { amount: "2", unit: "fl oz", ingredient: "Navy rum", catalogId: "navy-rum" },
      { amount: "", unit: "", ingredient: "Mystery", catalogId: "" },
    ]);
    expect(d.method).toBe("Shake.\n\nStrain.");
    expect(d.sourceNote).toHaveLength(200);
  });

  it("ignores an absurd row count", () => {
    expect(readRecipeForm(fd({ lines: "100000" })).ingredients).toEqual([]);
  });
});

describe("validateRecipe", () => {
  const ok = { ...emptyDraft(), name: "Test", ingredients: [{ amount: "1", unit: "oz", ingredient: "Rum", catalogId: "" }] };
  it("accepts a minimal recipe", () => expect(validateRecipe(ok)).toEqual({}));
  it("needs a name, ingredients, named lines and a real link", () => {
    expect(validateRecipe({ ...ok, name: "" }).name).toBeTruthy();
    expect(validateRecipe({ ...ok, name: "!!!" }).name).toBeTruthy();
    expect(validateRecipe({ ...ok, ingredients: [] }).ingredients).toBeTruthy();
    expect(validateRecipe({ ...ok, ingredients: [{ amount: "1", unit: "", ingredient: "", catalogId: "" }] }).lines).toEqual({
      0: "Say what the ingredient is.",
    });
    expect(validateRecipe({ ...ok, sourceUrl: "javascript:alert(1)" }).sourceUrl).toBeTruthy();
  });
});

describe("safeHttpUrl", () => {
  it.each([
    ["https://example.com/a?b=1", "https://example.com/a?b=1"],
    ["http://example.com", "http://example.com/"],
    ["javascript:alert(1)", null],
    ["ftp://x.com", null],
    ["https://user:pw@x.com", null],
    ["not a url", null],
    ["", null],
  ])("%s -> %s", (input, expected) => expect(safeHttpUrl(input)).toBe(expected));
});

describe("toCocktailRow", () => {
  it("only stores catalog ids that are set, and splits spirits", () => {
    const row = toCocktailRow({
      ...emptyDraft(),
      name: "T",
      primarySpirits: "Navy rum, navy rum, Gin, ",
      ingredients: [
        { amount: "1", unit: "oz", ingredient: "Rum", catalogId: "navy-rum" },
        { amount: "", unit: "", ingredient: "Soda", catalogId: "" },
      ],
      sourceUrl: "https://example.com",
    });
    expect(row.ingredients).toEqual([
      { amount: "1", unit: "oz", ingredient: "Rum", catalog_id: "navy-rum" },
      { amount: "", unit: "", ingredient: "Soda" },
    ]);
    expect(row.primary_spirits).toEqual(["Navy rum", "navy rum", "Gin"]);
    expect(row.glass).toBeNull();
    expect(row.source_url).toBe("https://example.com/");
  });
  it("de-duplicates spirits exactly", () => expect(parseSpirits("a, a, b")).toEqual(["a", "b"]));
});

describe("uniqueSlug", () => {
  it("avoids clashes and reserved words", () => {
    expect(uniqueSlug("Zombie", new Set(["zombie", "zombie-2"]))).toBe("zombie-3");
    expect(uniqueSlug("New", new Set(["new"]))).toBe("new-2");
    expect(uniqueSlug("Piña Colada!", new Set())).toBe("pina-colada");
  });
});

describe("best guess flag", () => {
  const fd2 = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  it("is read from the checkbox and written as is_guess", () => {
    expect(readRecipeForm(fd2({ name: "X", isGuess: "on" })).isGuess).toBe(true);
    expect(readRecipeForm(fd2({ name: "X" })).isGuess).toBe(false);
    expect(emptyDraft().isGuess).toBe(false);
    expect(toCocktailRow({ ...emptyDraft(), name: "X", isGuess: true }).is_guess).toBe(true);
    expect(toCocktailRow({ ...emptyDraft(), name: "X" }).is_guess).toBe(false);
  });
});
