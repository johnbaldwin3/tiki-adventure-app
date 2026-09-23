import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import seed from "../../seed-data/cocktails.json";
import { slugify } from "./slug";

// The slug migration hard-codes 100 (name, slug) pairs. Guard that they
// match slugify() and cover exactly the seeded cocktail names, so the
// live DB's slugs (and therefore every recipe-card URL) are provably right.
const sql = fs.readFileSync(
  path.join(__dirname, "../../supabase/migrations/0002_add_cocktail_slug.sql"),
  "utf8"
);
const pairs = [...sql.matchAll(/^\s*\('((?:[^']|'')*)', '([a-z0-9-]+)'\),?$/gm)].map((m) => ({
  name: m[1].replace(/''/g, "'"),
  slug: m[2],
}));

describe("0002_add_cocktail_slug.sql", () => {
  it("has one pair per seeded cocktail, covering exactly the seed names", () => {
    expect(pairs).toHaveLength(100);
    expect(new Set(pairs.map((p) => p.name))).toEqual(
      new Set((seed as { name: string }[]).map((c) => c.name))
    );
  });

  it("every slug equals slugify(name)", () => {
    for (const p of pairs) expect(p.slug, p.name).toBe(slugify(p.name));
  });
});
