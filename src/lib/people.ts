/**
 * Who's who for the signed-in viewer (multi-user, migration 0018): their
 * household (shared bar, can enter each other's tastings) and the friends
 * whose ratings they can read. The database decides who is visible (RLS on
 * tasters); this just orders and labels them.
 */

export interface Person {
  id: string;
  initials: string;
  displayName: string;
  householdId: string | null;
}

/** John & Genny keep their familiar order; everyone else sorts by initials. */
const PREFERRED_ORDER = ["JB", "GM"];

export function byTasterOrder(a: { initials: string }, b: { initials: string }): number {
  const rank = (i: string) => {
    const n = PREFERRED_ORDER.indexOf(i);
    return n === -1 ? PREFERRED_ORDER.length : n;
  };
  return rank(a.initials) - rank(b.initials) || a.initials.localeCompare(b.initials);
}

export interface People {
  /** The signed-in taster, or null when signed out (or not a taster). */
  me: Person | null;
  /** Everyone in my household, me included, in taster order. */
  household: Person[];
  /** Friends (and their households) whose ratings I can see. */
  friends: Person[];
}

export const NOBODY: People = { me: null, household: [], friends: [] };

/** Splits the visible tasters into my household and friends. */
export function groupPeople(meId: string | null, visible: Person[]): People {
  const me = visible.find((p) => p.id === meId) ?? null;
  if (!me) return NOBODY;
  const sorted = visible.slice().sort(byTasterOrder);
  return {
    me,
    household: sorted.filter((p) => p.householdId === me.householdId),
    friends: sorted.filter((p) => p.householdId !== me.householdId),
  };
}

/**
 * The (up to) two rating columns the list, stats and averages use: the
 * household's first two members' initials. Empty when signed out.
 */
export function householdSlots(people: People): string[] {
  return people.household.slice(0, 2).map((p) => p.initials);
}
