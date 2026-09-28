import { describe, expect, it } from "vitest";
import {
  draftFromMenu,
  draftFromModel,
  libraryForPrompt,
  MENU_JSON_SCHEMA,
  menuUserPrompt,
  pageText,
  parseCitations,
  RECIPE_JSON_SCHEMA,
  recipeJsonLd,
  userPrompt,
} from "./recipe-import";

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

describe("recipe from a menu", () => {
  const answer = {
    found: true,
    name: "Menu Mystery",
    primarySpirits: ["Jamaican rum"],
    glass: "Rocks",
    garnish: "",
    method: "Shake.",
    ingredients: [
      { amount: "1 1/2", unit: "fl oz", ingredient: "Aged Jamaican rum", catalogId: "aged-jamaican-rum" },
      { amount: "3/4", unit: "fl oz", ingredient: "Lime juice", catalogId: "lime" },
    ],
    sourceNote: "model text is ignored",
    warnings: [],
    reasoning: "  A sour   structure. ",
    basedOn: ["Painkiller", "Invented Drink", "Painkiller", 3],
  };
  const known = new Map([
    ["Painkiller", "painkiller"],
    ["Zombie", "zombie"],
  ]);

  it("marks the draft as a best guess, with a plain source note", () => {
    const r = draftFromMenu(answer, { place: " Three Dots  ", knownNames: known, citations: [] })!;
    expect(r.draft.isGuess).toBe(true);
    expect(r.draft.sourceNote).toBe("the menu at Three Dots");
    expect(r.draft.sourceUrl).toBe("");
    expect(r.draft.ingredients.map((l) => l.amount)).toEqual(["1 1/2", "3/4"]);
    expect(draftFromMenu(answer, { knownNames: known, citations: [] })!.draft.sourceNote).toBe("a menu description");
  });

  it("keeps only recipes that are really on our list, once each, with their slugs", () => {
    const r = draftFromMenu(answer, { knownNames: known, citations: [] })!;
    expect(r.guess).toEqual({ reasoning: "A sour structure.", basedOn: [{ name: "Painkiller", slug: "painkiller" }], sources: [] });
  });

  it("shows the API's citations (not the model's claims) as sources, but never saves one as the link", () => {
    const citations = [{ url: "https://example.com/a", title: "A" }];
    const r = draftFromMenu(answer, { knownNames: known, citations })!;
    expect(r.draft.sourceUrl).toBe("");
    expect(r.guess!.sources).toEqual(citations);
  });

  it("returns null when the model found no drink", () => {
    expect(draftFromMenu({ ...answer, found: false }, { knownNames: known, citations: [] })).toBeNull();
    expect(draftFromMenu("nope", { knownNames: known, citations: [] })).toBeNull();
  });

  it("imported (non-menu) drafts are never guesses", () => {
    expect(draftFromModel(answer)!.draft.isGuess).toBe(false);
  });

  it("the menu schema is the recipe schema plus reasoning and basedOn, all required", () => {
    expect(MENU_JSON_SCHEMA.required).toEqual([...RECIPE_JSON_SCHEMA.required, "reasoning", "basedOn"]);
    for (const k of MENU_JSON_SCHEMA.required) expect(MENU_JSON_SCHEMA.properties).toHaveProperty(k);
    expect(MENU_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("formats our recipes compactly for the prompt, capped", () => {
    const lib = [
      { name: "Painkiller", lines: ["2 fl oz Navy rum", "4 fl oz Pineapple juice"] },
      { name: "Zombie", lines: ["1 fl oz Rum"] },
    ];
    expect(libraryForPrompt(lib)).toBe("Painkiller: 2 fl oz Navy rum; 4 fl oz Pineapple juice\nZombie: 1 fl oz Rum");
    expect(libraryForPrompt(lib, 1)).toBe("Painkiller: 2 fl oz Navy rum; 4 fl oz Pineapple juice");
    // Over the size budget: whole lines only, never a cut-off ratio.
    expect(libraryForPrompt(lib, 250, 60)).toBe("Painkiller: 2 fl oz Navy rum; 4 fl oz Pineapple juice");
    expect(libraryForPrompt(lib, 250, 20)).toBe("Zombie: 1 fl oz Rum");
  });

  it("puts the menu text inside <menu> and names the drink and place", () => {
    const p = menuUserPrompt({ menu: "rum, lime", name: "Mystery", place: "Tiki Bar" }, "LIB");
    expect(p).toContain('the drink called "Mystery" at Tiki Bar described below');
    expect(p).toContain("LIB");
    expect(p).toMatch(/<menu>\nrum, lime\n<\/menu>$/);
    expect(menuUserPrompt({ menu: "" }, "LIB")).toContain("in the photo of the menu");
    expect(menuUserPrompt({ menu: "" }, "LIB")).not.toContain("<menu>");
  });
});

describe("parseCitations", () => {
  it("keeps http(s) url citations, deduplicated, at most 5", () => {
    const c = (url: unknown, title?: unknown) => ({ type: "url_citation", url_citation: { url, title } });
    expect(
      parseCitations([
        c("https://a.example/x", "A"),
        c("https://a.example/x", "A again"),
        c("javascript:alert(1)", "bad"),
        c(42),
        { type: "other" },
        null,
        c("http://b.example", undefined),
        c("https://c.example"),
        c("https://d.example"),
        c("https://e.example"),
        c("https://f.example"),
      ])
    ).toEqual([
      { url: "https://a.example/x", title: "A" },
      { url: "http://b.example", title: "http://b.example" },
      { url: "https://c.example", title: "https://c.example" },
      { url: "https://d.example", title: "https://d.example" },
      { url: "https://e.example", title: "https://e.example" },
    ]);
    expect(parseCitations(undefined)).toEqual([]);
    expect(parseCitations([c("https://x.example/" + "a".repeat(600))])).toEqual([]);
  });
});
