import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "@/data/ingredients";
import { SC_CATEGORIES, SC_STYLE_MAP } from "@/data/smugglers-cove";
import { bottleCategory, findBottle, normalizeBottle, searchBottles, styleCategory } from "./rum-numbers";

const num = (name: string) => findBottle(name)?.category.number ?? null;
const cat = (name: string) => findBottle(name)?.category.id ?? null;

describe("the Smuggler's Cove list (pp. 197-199)", () => {
  it("has the book's 21 categories, 8 of them numbered 1-8 in order", () => {
    expect(SC_CATEGORIES).toHaveLength(21);
    expect(SC_CATEGORIES.filter((c) => c.number).map((c) => [c.number, c.name])).toEqual([
      [1, "Pot still lightly aged"],
      [2, "Blended lightly aged"],
      [3, "Blended aged"],
      [4, "Column still aged"],
      [5, "Black blended"],
      [6, "Black blended overproof"],
      [7, "Cane AOC Martinique rhum agricole blanc"],
      [8, "Cane AOC Martinique rhum agricole vieux"],
    ]);
    expect(new Set(SC_CATEGORIES.map((c) => c.id)).size).toBe(21);
  });

  it("no match phrase points at two different categories", () => {
    const seen = new Map<string, string>();
    for (const c of SC_CATEGORIES) {
      for (const b of c.bottles) {
        for (const m of b.match) {
          const k = normalizeBottle(m);
          expect(k, m).toBe(m); // phrases are written already normalized
          if (seen.has(k)) expect(seen.get(k), m).toBe(c.id);
          seen.set(k, c.id);
        }
      }
    }
  });

  it("maps only real catalog styles to real categories", () => {
    const ids = new Set(INGREDIENTS.map((i) => i.id));
    for (const [style, m] of Object.entries(SC_STYLE_MAP)) {
      expect(ids.has(style), style).toBe(true);
      expect(SC_CATEGORIES.some((c) => c.id === m.category), m.category).toBe(true);
    }
  });
});

describe("findBottle", () => {
  it.each([
    ["Smith & Cross Traditional Jamaica Rum", 1],
    ["Appleton Estate Signature", 2],
    ["Planteray 3 Stars", 2],
    ["Appleton Estate 12 Year Old Rare Casks", 3],
    ["El Dorado 12yr", 3],
    ["Pusser's Gunpowder Proof", 3],
    ["Bacardi 8", 4],
    ["Zacapa 23", 4],
    ["Goslings Black Seal", 5],
    ["Hamilton 86 Demerara", 5],
    ["Lemon Hart 151", 6],
    ["Planteray O.F.T.D.", 6],
    ["Rhum J.M Blanc", 7],
    ["Rhum Clément V.S.O.P.", 8],
    ["Neisson Réserve Spéciale", 8],
  ])("%s -> %i", (name, n) => {
    expect(num(name)).toBe(n);
  });

  it("finds the unnumbered categories too", () => {
    expect(cat("Wray & Nephew White Overproof")).toBe("pot-still-unaged");
    expect(cat("Hamilton Jamaica Black")).toBe("black-pot-still");
    expect(cat("El Dorado 15 Year Old")).toBe("blended-long-aged");
    expect(cat("Don Q Cristal")).toBe("column-still-lightly-aged");
    expect(cat("Avuá Prata")).toBe("cachaca-unaged");
  });

  it("prefers the most specific listing", () => {
    expect(cat("Denizen Merchant's Reserve")).toBe("blended-aged");
    expect(cat("Denizen Aged White")).toBe("blended-lightly-aged");
    expect(cat("Pusser's 15")).toBe("blended-long-aged");
    expect(cat("Caña Brava 7")).toBe("column-still-aged");
    expect(cat("Hamilton Guyana 151")).toBe("black-blended-overproof");
  });

  it("handles today's label wording and other spellings", () => {
    expect(cat("Hamilton Jamaican Pot Still Black")).toBe("black-pot-still");
    expect(cat("Hamilton Jamaican Pot Still Gold")).toBe("pot-still-unaged");
    expect(num("Ron Zacapa Centenario 23")).toBe(4);
    expect(num("Bacardi Reserva Ocho")).toBe(4);
    expect(num("Rhum J.M Rhum Agricole Blanc")).toBe(7);
    expect(cat("Barbancourt Five Star")).toBe("cane-coffey-still-aged");
    expect(num("Dos Maderas PX 5+5")).toBe(3);
    expect(num("Blackwell Black Gold")).toBe(5);
    expect(cat("Ron del Barrilito Two Star")).toBe("column-still-lightly-aged");
    expect(num("Rhum Clément 6 ans Très Vieux")).toBe(8);
    expect(num("La Favorite Cœur d'Ambré")).toBe(8);
    expect(num("Chairman's Reserve")).toBe(3);
    expect(cat("Chairman's Reserve 1931")).toBe("blended-long-aged");
  });

  it("keeps different products apart", () => {
    expect(num("Flor de Caña Centenario 12")).toBe(4);
    expect(cat("Flor de Caña Centenario 25")).toBe("column-still-long-aged");
    expect(num("Ron Centenario 20")).toBe(4);
    expect(findBottle("La Favorite Coeur de Canne")).toBeNull();
    expect(findBottle("Chairman's Reserve White Label")).toBeNull();
    expect(findBottle("Denizen Vatted Dark")).toBeNull();
    expect(findBottle("Goslings Black Seal 151")).toBeNull();
    expect(findBottle("Goslings Gold")).toBeNull();
    expect(num("Wray & Nephew White Overproof")).toBeNull();
    expect(cat("Wray & Nephew White Overproof")).toBe("pot-still-unaged");
    expect(num("Lemon Hart 151")).toBe(6);
  });

  it("doesn't guess", () => {
    expect(findBottle("Crossfire Hurricane Gold")).toBeNull();
    expect(findBottle("Chairman's Reserve Spiced")).toBeNull();
    expect(findBottle("El Dorado 125")).toBeNull();
    expect(findBottle("")).toBeNull();
    expect(findBottle(null)).toBeNull();
  });
});

describe("styles and bottles in our bar", () => {
  it("gives our catalog styles their closest category", () => {
    expect(styleCategory("rhum-agricole-blanc")?.category.number).toBe(7);
    expect(styleCategory("dark-rum")?.category.number).toBe(5);
    expect(styleCategory("aged-jamaican-rum")).toMatchObject({ basis: "closest" });
    expect(styleCategory("pineapple-rum")).toBeNull();
    expect(styleCategory("lime")).toBeNull();
  });
  it("uses the actual bottle when the book lists it", () => {
    expect(bottleCategory("overproof-aged-pot-rum", "Planteray O.F.T.D.")).toMatchObject({ basis: "book", category: { number: 6 } });
    expect(bottleCategory("overproof-aged-pot-rum", null)).toMatchObject({ category: { number: 1 }, listed: null });
    expect(bottleCategory("lime", "Smith & Cross")).toMatchObject({ category: { number: 1 } });
  });
});

describe("searchBottles", () => {
  it("finds by name words and by category", () => {
    expect(searchBottles("el dorado").length).toBeGreaterThanOrEqual(5);
    expect(searchBottles("smith cross")[0].category.number).toBe(1);
    expect(searchBottles("Smith & Cross Navy Strength")[0].category.number).toBe(1);
    expect(searchBottles("martinique").every((h) => h.category.group === "cane")).toBe(true);
    expect(searchBottles("  ")).toEqual([]);
  });
});

describe("rum check (AI answers)", async () => {
  const { rumCheckFromBook, rumCheckFromModel, rumCheckPrompt, RUM_CHECK_SYSTEM } = await import("./rum-check");
  const ai = {
    found: true,
    product: "Mystery Estate 6 Year",
    origin: "Barbados",
    rawMaterial: "molasses",
    still: "blend of pot and column",
    age: "6 years",
    abv: 43,
    flavored: false,
    category: "blended-aged",
    confidence: "medium",
    reasoning: "A pot/column blend aged 6 years.",
    warnings: ["", "Age is from the label."],
  };
  it("uses the AI's category for bottles the book doesn't list", () => {
    expect(rumCheckFromModel(ai)).toMatchObject({ basis: "ai", category: { number: 3 }, confidence: "medium", abv: 43, warnings: ["Age is from the label."] });
  });
  it("lets the book overrule the AI", () => {
    expect(rumCheckFromModel({ ...ai, product: "Smith & Cross", category: "blended-aged" })).toMatchObject({
      basis: "book",
      category: { number: 1 },
      confidence: "high",
    });
    // The typed name counts too, if the label reading is off.
    expect(rumCheckFromModel({ ...ai, product: "Rum (label unclear)" }, "Coruba")).toMatchObject({ basis: "book", category: { number: 5 } });
  });
  it("doesn't classify flavored rums, unknown ids or nothing", () => {
    expect(rumCheckFromModel({ ...ai, flavored: true })!.category).toBeNull();
    expect(rumCheckFromModel({ ...ai, category: "made-up" })!.category).toBeNull();
    expect(rumCheckFromModel({ ...ai, found: false })).toBeNull();
    expect(rumCheckFromModel(null)).toBeNull();
    expect(rumCheckFromModel({ ...ai, abv: 500, confidence: "sure" })).toMatchObject({ abv: null, confidence: "low" });
  });
  it("answers listed names from the book with no AI", () => {
    expect(rumCheckFromBook("Hamilton 151")).toMatchObject({ basis: "book", category: { number: 6 } });
    expect(rumCheckFromBook("Mystery Estate")).toBeNull();
  });
  it("fences the name and lists every category for the model", () => {
    expect(rumCheckPrompt("a <b>c</b>", true)).toContain("<bottle_name>a bc/b</bottle_name>");
    for (const c of SC_CATEGORIES) expect(RUM_CHECK_SYSTEM).toContain(`${c.id}:`);
  });
});

describe("barRumCategory", async () => {
  const { barRumCategory } = await import("./rum-numbers");
  it("prefers the book's bottle, then our label, then the style", () => {
    expect(barRumCategory("dark-rum", "Coruba", "blended-aged")).toMatchObject({ basis: "book", category: { number: 5 } });
    expect(barRumCategory("dark-rum", "Mystery", "blended-aged")).toMatchObject({ basis: "saved", approx: false, category: { number: 3 } });
    expect(barRumCategory("dark-rum", "Mystery", "blended-aged", "ai")).toMatchObject({ basis: "saved", approx: true });
    expect(barRumCategory("dark-rum", "Hamilton Jamaica Black", null)).toMatchObject({ basis: "book", category: { id: "black-pot-still" } });
    expect(barRumCategory("rhum-agricole-blanc", null, null)).toMatchObject({ basis: "style", approx: false, category: { number: 7 } });
    expect(barRumCategory("dark-rum", null, null)).toMatchObject({ basis: "style", approx: true, category: { number: 5 } });
    expect(barRumCategory("aged-jamaican-rum", "Crossfire Hurricane", "not-a-category")).toMatchObject({ basis: "style", approx: true });
    expect(barRumCategory("pineapple-rum", null, null)).toBeNull();
  });
});

describe("migration 0015", async () => {
  const fs = await import("node:fs");
  it("allows exactly the app's 21 category ids", () => {
    const sql = fs.readFileSync("supabase/migrations/0015_rum_categories.sql", "utf8");
    const ids = [...sql.matchAll(/^\s+'([a-z-]+)',?$/gm)].map((m) => m[1]);
    expect(ids).toEqual(SC_CATEGORIES.map((c) => c.id));
  });
});
