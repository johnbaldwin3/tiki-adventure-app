import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seed from "../../seed-data/cocktails.json";
import iba from "../../seed-data/iba-cocktails.json";
import collectionsSeed from "../../seed-data/collections.json";
import { parseAmount } from "./amounts";
import { slugify } from "./slug";
import { buildSql } from "../../scripts/generate-collections-sql.mjs";

const diffordsNames = new Set((seed as { name: string }[]).map((c) => c.name));
const ibaNames = new Set(iba.cocktails.map((c) => c.name));

describe("IBA seed data", () => {
  it("has the 96 IBA drinks not already in Difford's list, with unique names and slugs", () => {
    expect(iba.cocktails).toHaveLength(96);
    expect(ibaNames.size).toBe(96);
    for (const c of iba.cocktails) {
      expect(diffordsNames.has(c.name), c.name).toBe(false);
      expect(c.slug, c.name).toBe(slugify(c.name));
      expect(c.ibaUrl, c.name).toMatch(/^https:\/\/iba-world\.com\/iba-cocktail\/[a-z0-9-]+\/$/);
      expect(c.primarySpirits.length, c.name).toBeGreaterThan(0);
    }
    const slugs = new Set([...(seed as { name: string }[]).map((c) => slugify(c.name)), ...iba.cocktails.map((c) => c.slug)]);
    expect(slugs.size).toBe(196);
  });

  it("maps each overlap to a real Difford's drink", () => {
    for (const name of Object.values(iba.overlaps)) expect(diffordsNames.has(name), name).toBe(true);
    expect(Object.keys(iba.overlaps)).toHaveLength(6);
  });

  it("uses only units the app understands, and numeric amounts parse (counts like 6-8 are ranges)", () => {
    const units = new Set(iba.cocktails.flatMap((c) => c.ingredients.map((i) => i.unit)));
    expect([...units].sort()).toEqual(["", "barspoon", "dash", "drop", "ml", "tbsp", "thin slices", "tsp"]);
    for (const c of iba.cocktails) {
      for (const i of c.ingredients) {
        if (i.unit === "ml") expect(parseAmount(i.amount).kind, `${c.name}: ${i.ingredient}`).not.toBe("text");
      }
    }
    const oldCuban = iba.cocktails.find((c) => c.name === "Old Cuban")!;
    expect(oldCuban.ingredients.find((i) => /mint/i.test(i.ingredient))!.amount).toBe("6-8");
  });
});

describe("collections seed data", () => {
  const byName = new Set([...diffordsNames, ...ibaNames]);
  it("starts with Tiki, Classics and Prohibition, every member a real drink", () => {
    expect(collectionsSeed.collections.map((c) => c.slug)).toEqual(["tiki", "classics", "prohibition"]);
    for (const c of collectionsSeed.collections) {
      const members = [...(Array.isArray(c.members) ? c.members : []), ...(c.extra ?? [])];
      for (const m of members) expect(byName.has(m.name), `${c.slug}: ${m.name}`).toBe(true);
    }
  });

  it("puts all 102 IBA drinks in Classics (96 new + the 6 overlapping Difford's rows)", () => {
    const classics = collectionsSeed.collections.find((c) => c.slug === "classics")!;
    expect(classics.members).toHaveLength(102);
  });

  it("gives every Prohibition drink a dated note and an http source", () => {
    const p = collectionsSeed.collections.find((c) => c.slug === "prohibition")!;
    const members = p.members as { name: string; note?: string; noteUrl?: string }[];
    expect(members).toHaveLength(18);
    for (const m of members) {
      expect(m.note, m.name).toMatch(/\d{4}/);
      expect(m.noteUrl, m.name).toMatch(/^https:\/\//);
      expect(m.note!.length).toBeLessThanOrEqual(400);
    }
    // Undocumented until after repeal, so left out.
    expect(members.some((m) => m.name === "Bloody Mary" || m.name === "Mimosa")).toBe(false);
  });

  it("migration 0012 is exactly what the generator makes from the seed data", () => {
    const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/0012_iba_and_collections.sql"), "utf8");
    expect(sql).toBe(buildSql());
  });
});
