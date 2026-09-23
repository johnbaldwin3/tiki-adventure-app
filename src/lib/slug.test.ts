import { describe, expect, it } from "vitest";
import seed from "../../seed-data/cocktails.json";
import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Tiki Max", "tiki-max"],
    ["Près du Quai", "pres-du-quai"],
    ["3 Monkeys & a dash", "3-monkeys-and-a-dash"],
    ["Shark's Tooth (by Don Beach)", "sharks-tooth-by-don-beach"],
    ["Humuhumunukunukuapua'a", "humuhumunukunukuapuaa"],
    ["Gun Club Punch No.1", "gun-club-punch-no-1"],
    ["Mr. Bali Hai", "mr-bali-hai"],
    ["Pineapple Daiquiri (on-the-rocks)", "pineapple-daiquiri-on-the-rocks"],
  ])("%s -> %s", (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });

  it("gives every one of the 100 seeded cocktails a unique, non-empty slug", () => {
    const slugs = (seed as { name: string }[]).map((c) => slugify(c.name));
    expect(slugs).toHaveLength(100);
    expect(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))).toBe(true);
    expect(new Set(slugs).size).toBe(100);
  });
});
