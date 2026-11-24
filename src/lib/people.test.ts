import { describe, expect, it } from "vitest";
import { groupPeople, householdSlots, NOBODY } from "./people";

const p = (id: string, initials: string, householdId: string) => ({ id, initials, displayName: initials, householdId });
const visible = [p("fr", "FR", "h2"), p("gm", "GM", "h1"), p("ab", "AB", "h2"), p("jb", "JB", "h1")];

describe("groupPeople", () => {
  it("splits visible tasters into my household (JB before GM) and friends", () => {
    const people = groupPeople("gm", visible);
    expect(people.me?.initials).toBe("GM");
    expect(people.household.map((x) => x.initials)).toEqual(["JB", "GM"]);
    expect(people.friends.map((x) => x.initials)).toEqual(["AB", "FR"]);
    expect(householdSlots(people)).toEqual(["JB", "GM"]);
  });

  it("gives a friend's household its own columns", () => {
    expect(householdSlots(groupPeople("fr", visible))).toEqual(["AB", "FR"]);
    expect(householdSlots(groupPeople("fr", [p("fr", "FR", "h2")]))).toEqual(["FR"]);
  });

  it("is nobody when signed out or not visible", () => {
    expect(groupPeople(null, visible)).toBe(NOBODY);
    expect(groupPeople("zz", visible)).toBe(NOBODY);
    expect(householdSlots(NOBODY)).toEqual([]);
  });
});
