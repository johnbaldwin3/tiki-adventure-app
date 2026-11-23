import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "@/data/ingredients";
import { guessStyle, normalizeName } from "./bottle-guess";

const styles = [
  { id: "jamaican-overproof", brands: ["Smith & Cross", "Hamilton 151"] },
  { id: "white-rum", brands: ["Bacardi Carta Blanca", "Havana Club Añejo 3 Años"] },
  { id: "gold-rum", brands: ["Bacardi Carta Oro"] },
];

describe("normalizeName", () => {
  it("drops accents, case, punctuation and unifies &", () => {
    expect(normalizeName("Havana Club Añejo 3 Años")).toBe(" havana club anejo 3 anos ");
    expect(normalizeName("Smith & Cross")).toBe(normalizeName("smith and cross"));
    expect(normalizeName("Myers's")).toBe(" myerss ");
  });
});

describe("guessStyle", () => {
  it("finds the style from a fuller bottle name", () => {
    expect(guessStyle("Smith & Cross Traditional Jamaica Rum", styles)).toBe("jamaican-overproof");
    expect(guessStyle("havana club anejo 3 anos", styles)).toBe("white-rum");
  });
  it("matches a name typed partway", () => {
    expect(guessStyle("Smith and Cr", styles)).toBe("jamaican-overproof");
  });
  it("prefers the longer, more specific brand", () => {
    expect(guessStyle("Bacardi Carta Oro Superior", styles)).toBe("gold-rum");
  });
  it("leaves it blank when unsure", () => {
    expect(guessStyle("Bacardi", styles)).toBe(""); // two styles start with it
    expect(guessStyle("Some Home Infusion", styles)).toBe("");
    expect(guessStyle("Ham", styles)).toBe(""); // too short to guess
  });
  it("works against the real catalog", () => {
    const catalog = INGREDIENTS.filter((i) => !i.staple);
    const sc = catalog.find((i) => i.brands.includes("Smith & Cross"))!;
    expect(guessStyle("Smith & Cross Jamaica Rum 750ml", catalog)).toBe(sc.id);
  });
});
