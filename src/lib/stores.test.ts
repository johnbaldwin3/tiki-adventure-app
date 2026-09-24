import { describe, expect, it } from "vitest";
import { bottleSearchTerm, totalWineSearchUrl, WINEXPRESS } from "./stores";

describe("bottleSearchTerm", () => {
  it.each([
    ["Smith & Cross", "Smith & Cross"],
    ["Pusser's Gunpowder Proof (54.5%)", "Pusser's Gunpowder Proof"],
    ["Black Tot (46.2%, below navy strength)", "Black Tot"],
    ["Rum Fire Overproof (Hampden)", "Rum Fire Overproof"],
  ])("%s -> %s", (brand, expected) => {
    expect(bottleSearchTerm(brand)).toBe(expected);
  });
});

describe("totalWineSearchUrl", () => {
  it("builds an encoded Total Wine search link", () => {
    expect(totalWineSearchUrl("Smith & Cross")).toBe("https://www.totalwine.com/search/all?text=Smith%20%26%20Cross");
    expect(totalWineSearchUrl("Planteray O.F.T.D.")).toBe("https://www.totalwine.com/search/all?text=Planteray%20O.F.T.D.");
  });
});

describe("WINEXPRESS", () => {
  it("has a dialable tel: link matching the displayed number", () => {
    expect(WINEXPRESS.phoneHref).toBe(`tel:+1${WINEXPRESS.phoneDisplay.replace(/\D/g, "")}`);
  });
});
