import { INGREDIENTS, type Family } from "@/data/ingredients";

/**
 * Broad spirit picks for the ingredient filter: "Any rum" matches a drink
 * with any bottle from the rum shelf, so tasters don't have to add every
 * rum style one by one. Each group is one or more catalog families; the
 * ids live in the same ?ing= list as single ingredients.
 */
export interface SpiritGroup {
  id: string;
  label: string;
  families: Family[];
}

export const SPIRIT_GROUPS: SpiritGroup[] = [
  { id: "any-rum", label: "Any rum or cane spirit", families: ["Rum", "Other cane spirits"] },
  { id: "any-gin", label: "Any gin or genever", families: ["Gin & genever"] },
  { id: "any-whiskey", label: "Any whiskey", families: ["Whiskey"] },
  { id: "any-brandy", label: "Any brandy", families: ["Brandy"] },
  { id: "any-agave", label: "Any tequila or mezcal", families: ["Agave"] },
  { id: "any-vodka", label: "Any vodka", families: ["Vodka"] },
];

const BY_ID = new Map(SPIRIT_GROUPS.map((g) => [g.id, g]));
const MEMBERS = new Map(
  SPIRIT_GROUPS.map((g) => [g.id, new Set(INGREDIENTS.filter((i) => g.families.includes(i.family)).map((i) => i.id))])
);

export const getSpiritGroup = (id: string) => BY_ID.get(id);

/** The catalog ingredient ids a group covers (empty for a plain ingredient id). */
export const groupMembers = (id: string): Set<string> => MEMBERS.get(id) ?? new Set();

/** Does a drink (its catalog ingredient ids) contain this ingredient, or any bottle of this group? */
export function hasIngredientOrGroup(cocktailIds: Set<string>, id: string): boolean {
  if (cocktailIds.has(id)) return true;
  const members = MEMBERS.get(id);
  if (!members) return false;
  for (const m of members) if (cocktailIds.has(m)) return true;
  return false;
}
