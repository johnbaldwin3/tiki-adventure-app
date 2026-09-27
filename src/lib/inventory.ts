import { formatFraction, ML_PER_FL_OZ, mlPerUnit, parseAmount } from "./amounts";
import { resolveLine } from "./ingredients";

/**
 * Pure logic for the living bar inventory: what a drink pours, bottle
 * levels, and when something is running low.
 */

/** Common bottle sizes (ml). */
export const SIZE_CHOICES = [50, 100, 200, 375, 500, 700, 750, 1000, 1750] as const;
export const DEFAULT_SIZE = 750;

/** Quick "how much is left" choices, as a fraction of the bottle. */
export const LEVEL_CHOICES = [
  { value: 1, label: "Full" },
  { value: 0.75, label: "¾" },
  { value: 0.5, label: "½" },
  { value: 0.25, label: "¼" },
  { value: 0.1, label: "Nearly empty" },
  { value: 0, label: "Empty" },
] as const;

export interface BottleLevel {
  sizeMl: number | null;
  /** null = not tracked. */
  remainingMl: number | null;
}

export interface PourLine {
  ingredientId: string;
  ml: number;
}

/** A recorded pour line: what the recipe poured, and what came out of a tracked bottle. */
export interface RecordedPourLine extends PourLine {
  takenMl: number;
}

/**
 * What making `servings` of a drink pours, per ingredient style, in ml.
 * Counts only lines we can measure (liquid volume units) that map to a
 * catalog style and aren't marked optional or staples (fresh citrus etc.
 * aren't tracked). Ranges count their midpoint.
 */
export function pourLines(
  lines: { amount: string; unit: string; ingredient: string; catalogId?: string | null }[],
  servings: number
): PourLine[] {
  const byId = new Map<string, number>();
  for (const l of lines) {
    const r = resolveLine(l.ingredient, l.catalogId);
    if (!r || r.optional || r.ingredient.staple) continue;
    const perUnit = mlPerUnit(l.unit);
    if (perUnit === null) continue;
    const p = parseAmount(l.amount);
    const n = p.kind === "number" ? p.value : p.kind === "range" ? (p.low + p.high) / 2 : null;
    if (n === null || n <= 0) continue;
    byId.set(r.ingredient.id, (byId.get(r.ingredient.id) ?? 0) + n * perUnit * servings);
  }
  // 0.1 ml: the precision the database keeps (so a pour and its undo match).
  return [...byId.entries()].map(([ingredientId, ml]) => ({ ingredientId, ml: Math.round(ml * 10) / 10 }));
}

/** Below this much a tracked bottle counts as running low: a fifth of the bottle, but at least about two pours (60 ml) for normal bottles. */
export function lowThresholdMl(sizeMl: number | null): number {
  if (!sizeMl) return 60;
  return Math.max(sizeMl * 0.2, Math.min(60, sizeMl * 0.5));
}

export function isLow(level: BottleLevel): boolean {
  return level.remainingMl !== null && level.remainingMl <= lowThresholdMl(level.sizeMl);
}

/** Fraction of the bottle left (0-1), or null if we don't know the size or aren't tracking. */
export function fractionLeft(level: BottleLevel): number | null {
  if (level.remainingMl === null || !level.sizeMl) return null;
  return Math.max(0, Math.min(1, level.remainingMl / level.sizeMl));
}

/** "about 210 ml (7 fl oz) left" / "empty". */
export function describeLeft(level: BottleLevel): string | null {
  if (level.remainingMl === null) return null;
  if (level.remainingMl <= 0) return "empty";
  if (level.remainingMl < 5) return "a few drops left";
  const ml = Math.round(level.remainingMl / 5) * 5;
  const oz = Math.round((level.remainingMl / ML_PER_FL_OZ) * 4) / 4;
  return oz > 0 ? `about ${ml} ml (${formatFraction(oz)} fl oz) left` : `about ${ml} ml left`;
}

/** Validates a submitted bottle size (one of the choices, or a sane number). */
export function parseSize(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 10 && n <= 5000 ? Math.round(n) : null;
}

/** Validates a submitted level fraction (0-1). */
export function parseLevel(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}
