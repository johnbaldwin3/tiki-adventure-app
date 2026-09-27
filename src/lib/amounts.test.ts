import { describe, expect, it } from "vitest";
import seed from "../../seed-data/cocktails.json";
import { displayAmount, formatFraction, formatMl, mlPerUnit, parseAmount, parseNumber, parseServings, parseUnitMode } from "./amounts";

describe("parseNumber", () => {
  it.each([
    ["1", 1],
    ["1/2", 0.5],
    ["1 1/2", 1.5],
    ["1½", 1.5],
    ["½", 0.5],
    ["1⅔", 5 / 3],
    ["5/12", 5 / 12],
    ["1.5", 1.5],
    ["  2 ", 2],
    ["", null],
    ["Top up", null],
    ["1/0", null],
  ])("%s -> %s", (t, n) => {
    const v = parseNumber(t);
    if (n === null) expect(v).toBeNull();
    else expect(v).toBeCloseTo(n as number, 9);
  });

  it("shows every Top 100 fl oz amount as Difford's exact ml (x30), nothing lost to rounding", () => {
    const lines = (seed as { ingredients: { amount: string; unit: string }[] }[]).flatMap((c) => c.ingredients);
    for (const l of lines.filter((l) => l.unit === "fl oz")) {
      const exact = parseNumber(l.amount)! * 30;
      expect(Number(displayAmount(l.amount, l.unit, 1, "ml").amount)).toBeCloseTo(exact, 9);
    }
  });

  it("reads every amount in the Top 100", () => {
    const amounts = (seed as { ingredients: { amount: string }[] }[]).flatMap((c) => c.ingredients.map((i) => i.amount));
    expect(amounts.filter((a) => a.trim() !== "" && parseAmount(a).kind === "text")).toEqual([]);
  });
});

describe("parseAmount ranges", () => {
  it("reads 2-3 and 1 to 2", () => {
    expect(parseAmount("2-3")).toEqual({ kind: "range", low: 2, high: 3 });
    expect(parseAmount("1 to 1 1/2")).toEqual({ kind: "range", low: 1, high: 1.5 });
  });
});

describe("formatting", () => {
  it.each([
    [1.5, "1 1/2"],
    [1 / 6, "1/6"],
    [5 / 12, "5/12"],
    [2, "2"],
    [2 / 3 + 2 / 3, "1 1/3"],
    [0.37, "0.37"],
  ])("%s -> %s", (n, s) => expect(formatFraction(n)).toBe(s));
  it("rounds ml to halves", () => {
    expect(formatMl(12.5)).toBe("12.5");
    expect(formatMl(45)).toBe("45");
    expect(formatMl(1.25)).toBe("1.25");
    expect(formatMl(7.4)).toBe("7.5");
  });
});

describe("mlPerUnit", () => {
  it("knows volume units and leaves counted ones alone", () => {
    expect(mlPerUnit("fl oz")).toBe(30);
    expect(mlPerUnit("oz")).toBe(30);
    expect(mlPerUnit("cl")).toBe(10);
    expect(mlPerUnit("cup")).toBe(240);
    expect(mlPerUnit("tbsp")).toBe(15);
    expect(mlPerUnit("barspoon")).toBeNull();
    expect(mlPerUnit("dash")).toBeNull();
    expect(mlPerUnit("leaves")).toBeNull();
  });
});

describe("displayAmount", () => {
  it("shows Difford's millilitres exactly", () => {
    expect(displayAmount("1 1/2", "fl oz", 1, "ml")).toEqual({ amount: "45", unit: "ml", note: null, converted: true });
    expect(displayAmount("1/6", "fl oz", 1, "ml").amount).toBe("5");
    expect(displayAmount("5/12", "fl oz", 1, "ml").amount).toBe("12.5");
    expect(displayAmount("1/24", "fl oz", 1, "ml").amount).toBe("1.25");
    expect(displayAmount("1/24", "fl oz", 3, "ml").amount).toBe("3.75");
  });
  it("scales for servings", () => {
    expect(displayAmount("3/4", "fl oz", 2, "original")).toEqual({ amount: "1 1/2", unit: "fl oz", note: null, converted: false });
    expect(displayAmount("1/6", "fl oz", 3, "original").amount).toBe("1/2");
  });
  it("scales counted things to whole numbers, pluralised", () => {
    expect(displayAmount("1", "dash", 3, "ml")).toEqual({ amount: "3", unit: "dashes", note: null, converted: false });
    expect(displayAmount("4", "drop", 1, "ml").unit).toBe("drops");
    expect(displayAmount("1", "dashes", 1, "oz").unit).toBe("dash");
    expect(displayAmount("2", "leaf", 2, "original").unit).toBe("leaves");
    expect(displayAmount("3", "drop", 3, "oz").amount).toBe("9");
  });
  it("converts ml and spoons to fl oz, with a cup hint for big batches", () => {
    expect(displayAmount("45", "ml", 1, "oz")).toEqual({ amount: "1 1/2", unit: "fl oz", note: null, converted: true });
    expect(displayAmount("2", "tbsp", 1, "oz").amount).toBe("1");
    expect(displayAmount("3", "fl oz", 4, "oz")).toEqual({ amount: "12", unit: "fl oz", note: "about 1 1/2 cups", converted: false });
    expect(displayAmount("4", "fl oz", 2, "oz").note).toBe("about 1 cup");
    expect(displayAmount("1", "fl oz", 6, "oz").note).toBeNull();
  });
  it("never converts barspoons (powders)", () => {
    expect(displayAmount("1/4", "barspoon", 1, "ml")).toEqual({ amount: "1/4", unit: "barspoon", note: null, converted: false });
    expect(displayAmount("¼", "barspoon", 3, "oz")).toEqual({ amount: "3/4", unit: "barspoon", note: null, converted: false });
  });
  it("keeps 'as written' untouched at 1 serving, and metric decimals when scaled", () => {
    expect(displayAmount("22.5", "ml", 1, "original")).toEqual({ amount: "22.5", unit: "ml", note: null, converted: false });
    expect(displayAmount("½", "fl oz", 1, "original").amount).toBe("½");
    expect(displayAmount("7.5", "ml", 3, "original").amount).toBe("22.5");
  });
  it("reads US mixed numbers and rejects backwards ranges", () => {
    expect(displayAmount("1-1/2", "oz", 2, "ml").amount).toBe("90");
    expect(parseAmount("3-2")).toEqual({ kind: "text" });
    expect(parseNumber("11/12")).toBeCloseTo(11 / 12);
    expect(parseNumber("10/3")).toBeCloseTo(10 / 3);
  });
  it("leaves unreadable amounts as written", () => {
    expect(displayAmount("Top up", "", 3, "ml")).toEqual({ amount: "Top up", unit: "", note: null, converted: false });
    expect(displayAmount("", "", 2, "oz")).toEqual({ amount: "", unit: "", note: null, converted: false });
    expect(displayAmount("about 2", "fl oz", 2, "ml").note).toBe("(×2)");
  });
});

describe("query params", () => {
  it("fall back safely", () => {
    expect(parseServings("3")).toBe(3);
    expect(parseServings("0")).toBe(1);
    expect(parseServings("99")).toBe(1);
    expect(parseServings("2.5")).toBe(1);
    expect(parseUnitMode("ml")).toBe("ml");
    expect(parseUnitMode("cups")).toBeNull();
    expect(parseUnitMode(undefined)).toBeNull();
  });
});
