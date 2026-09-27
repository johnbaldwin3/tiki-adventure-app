import { drinkAvailability, type CabinetDrink } from "./cabinet";
import { byListOrder } from "./order";
import { safeNextPath } from "./auth/validate";
import { getIngredient } from "./ingredients";

/**
 * Pure logic for the shared shopping list: what each item on the list
 * would let us make, and suggestions for what to add.
 */

export interface ShoppingItemSummary<D extends CabinetDrink = CabinetDrink> {
  ingredientId: string;
  /**
   * Drinks we can't make now but could once we buy everything on the list,
   * that need this item. Not-yet-tried drinks first, then by Difford's rank.
   */
  completes: D[];
  /** How many of the drinks need this ingredient at all. */
  usedBy: number;
}

export interface ShoppingSummary<D extends CabinetDrink = CabinetDrink> {
  items: ShoppingItemSummary<D>[];
  /** Drinks that buying the whole list would make possible. */
  unlocks: D[];
}

const byTriedThenRank = <D extends CabinetDrink>(a: D, b: D) =>
  Number(a.tried) - Number(b.tried) || byListOrder(a, b);

/**
 * The list's items are the ids in `list` the catalog knows, minus staples
 * and anything already in the cabinet. Order: most completes, then name.
 */
export function summarizeShopping<D extends CabinetDrink>(
  drinks: D[],
  have: Set<string>,
  list: Iterable<string>
): ShoppingSummary<D> {
  const listed = [...new Set(list)].filter((id) => {
    const i = getIngredient(id);
    return !!i && !i.staple && !have.has(id);
  });
  const after = new Set([...have, ...listed]);
  const unlocks: D[] = [];
  const completes = new Map<string, D[]>(listed.map((id) => [id, []]));
  const usedBy = new Map<string, number>(listed.map((id) => [id, 0]));

  for (const d of drinks) {
    const now = drinkAvailability(d, have);
    for (const id of listed) {
      if (now.missing.includes(id)) usedBy.set(id, usedBy.get(id)! + 1);
    }
    if (now.unknown.length > 0 || now.missing.length === 0) continue;
    if (drinkAvailability(d, after).missing.length > 0) continue;
    unlocks.push(d);
    for (const id of now.missing) completes.get(id)?.push(d);
  }

  const name = (id: string) => getIngredient(id)?.name ?? id;
  const items = listed
    .map((id) => ({ ingredientId: id, completes: completes.get(id)!.sort(byTriedThenRank), usedBy: usedBy.get(id)! }))
    .sort((a, b) => b.completes.length - a.completes.length || name(a.ingredientId).localeCompare(name(b.ingredientId)));
  return { items, unlocks: unlocks.sort(byTriedThenRank) };
}

/**
 * Adds a query parameter to a local path (keeps any existing ones and the
 * #hash). The input and the result are both checked with safeNextPath, so
 * it can never produce an off-site redirect.
 */
export function withParam(path: string, key: string, value: string): string {
  const url = new URL(safeNextPath(path), "http://local.invalid");
  url.searchParams.set(key, value);
  return safeNextPath(`${url.pathname}${url.search}${url.hash}`);
}
