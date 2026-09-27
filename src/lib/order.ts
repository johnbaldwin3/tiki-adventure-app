/**
 * The list's order: Difford's Top 100 by rank, then our own recipes by name.
 */
export function byListOrder(
  a: { diffordsRank: number | null; name: string },
  b: { diffordsRank: number | null; name: string }
): number {
  const ra = a.diffordsRank ?? Number.POSITIVE_INFINITY;
  const rb = b.diffordsRank ?? Number.POSITIVE_INFINITY;
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.name.localeCompare(b.name);
}
