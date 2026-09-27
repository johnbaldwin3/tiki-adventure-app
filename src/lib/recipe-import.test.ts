import { describe, expect, it } from "vitest";
import { draftFromModel, pageText, RECIPE_JSON_SCHEMA, recipeJsonLd, userPrompt } from "./recipe-import";

describe("draftFromModel", () => {
  const good = {
    found: true,
    name: "  Test   Swizzle ",
    primarySpirits: ["Navy rum", 7, ""],
    glass: "Collins",
    garnish: "",
    method: "Shake. Strain.",
    ingredients: [
      { amount: "2", unit: "fl oz", ingredient: "Navy rum", catalogId: "navy-rum" },
      { amount: "1", unit: "dash", ingredient: "Tincture", catalogId: "not-real" },
      { amount: "1", unit: "", ingredient: "" },
      "junk",
    ],
    sourceNote: "Book, p. 3",
    warnings: ["Amount for tincture unclear", 42],
  };

  it("keeps only well-formed, known data", () => {
    const r = draftFromModel(good, "https://example.com/r")!;
    expect(r.draft.name).toBe("Test Swizzle");
    expect(r.draft.primarySpirits).toBe("Navy rum");
    expect(r.draft.ingredients).toEqual([
      { amount: "2", unit: "fl oz", ingredient: "Navy rum", catalogId: "navy-rum" },
      { amount: "1", unit: "dash", ingredient: "Tincture", catalogId: "" },
    ]);
    expect(r.draft.sourceUrl).toBe("https://example.com/r");
    expect(r.warnings).toEqual(["Amount for tincture unclear"]);
  });

  it("returns null when there's no recipe", () => {
    expect(draftFromModel({ ...good, found: false })).toBeNull();
    expect(draftFromModel({ found: true, name: "", ingredients: [] })).toBeNull();
    expect(draftFromModel("nope")).toBeNull();
    expect(draftFromModel(null)).toBeNull();
  });

  it("caps long fields", () => {
    const r = draftFromModel({ ...good, name: "x".repeat(500), ingredients: Array(50).fill(good.ingredients[0]) })!;
    expect(r.draft.name).toHaveLength(80);
    expect(r.draft.ingredients).toHaveLength(30);
  });
});

describe("schema and prompt", () => {
  it("asks for every field (strict structured output)", () => {
    expect([...RECIPE_JSON_SCHEMA.required].sort()).toEqual(Object.keys(RECIPE_JSON_SCHEMA.properties).sort());
  });
  it("includes the catalog and the source", () => {
    const p = userPrompt("link", { url: "https://x.com", text: "2 oz rum" });
    expect(p).toContain("navy-rum: Navy rum");
    expect(p).toContain("https://x.com");
    expect(p).toContain("<source>\n2 oz rum\n</source>");
  });
});

describe("recipe web pages", () => {
  const html = `<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Swizzle","recipeIngredient":["2 oz rum"],"recipeInstructions":[{"@type":"HowToStep","text":"Swizzle."}]}]}</script>
  <script>evil()</script><style>.x{}</style></head>
  <body><nav>Menu</nav><h1>Swizzle &amp; Co</h1><p>2&nbsp;oz rum<br>1 oz lime &frac12;</p></body></html>`;

  it("finds schema.org Recipe data, even inside @graph", () => {
    const ld = recipeJsonLd(html)!;
    expect(ld).toContain('"name": "Swizzle"');
    expect(ld).toContain("2 oz rum");
  });
  it("returns null without Recipe data or with broken JSON", () => {
    expect(recipeJsonLd("<p>hi</p>")).toBeNull();
    expect(recipeJsonLd('<script type="application/ld+json">{oops</script>')).toBeNull();
  });
  it("keeps readable text only", () => {
    const t = pageText(html);
    expect(t).toContain("Swizzle & Co");
    expect(t).toContain("2 oz rum");
    expect(t).toContain("½");
    expect(t).not.toContain("evil");
    expect(t).not.toContain("Menu");
  });
});
