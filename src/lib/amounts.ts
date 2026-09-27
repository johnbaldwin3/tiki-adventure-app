/**
 * Recipe amounts: parse ("1 1/2", "¾", "1.5", "1-1/2", "2-3"), scale for
 * servings, and convert volume units. Pure, so it's unit-tested.
 *
 * Conversions use the bar standard 1 fl oz = 30 ml -- the convention
 * Difford's Guide itself uses (its 5 ml appears as 1/6 fl oz here, 12.5 ml
 * as 5/12, 1.25 ml as 1/24), so "ml" shows Difford's original millilitre
 * amounts exactly. A cup is 8 fl oz = 240 ml on the same basis.
 */

export type UnitMode = "original" | "oz" | "ml";
export const UNIT_MODES: { value: UnitMode; label: string }[] = [
  { value: "original", label: "As written" },
  { value: "oz", label: "fl oz" },
  { value: "ml", label: "ml" },
];
export const ML_PER_FL_OZ = 30;
/** Largest serving count accepted from the URL (the buttons offer 1–8). */
export const MAX_SERVINGS = 12;
/** Cookie remembering the chosen unit mode (set in the browser when a unit is picked). */
export const UNITS_COOKIE = "tiki-units";

const VULGAR: Record<string, number> = {
  "½": 1 / 2,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 1 / 4,
  "¾": 3 / 4,
  "⅕": 1 / 5,
  "⅙": 1 / 6,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

/**
 * Parses one number: "1", "1.5", "3/4", "11/12", "½", "1 1/2", "1½", and
 * the US "1-1/2". Null if it isn't one.
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s+/g, " ");
  const m = t.match(
    /^(?:(\d+(?:\.\d+)?)(?:[ -](?=\d+\/)|(?=[½⅓⅔¼¾⅕⅙⅛⅜⅝⅞])|$))?(?:(\d+)\/(\d+)|([½⅓⅔¼¾⅕⅙⅛⅜⅝⅞]))?$/
  );
  if (!m || (!m[1] && !m[2] && !m[4])) return null;
  let n = m[1] ? Number(m[1]) : 0;
  if (m[2]) {
    const den = Number(m[3]);
    if (den === 0) return null;
    n += Number(m[2]) / den;
  }
  if (m[4]) n += VULGAR[m[4]];
  return n;
}

/** An amount: a single number, a range ("2-3"), or text we don't understand (kept as is). */
export type ParsedAmount =
  | { kind: "number"; value: number }
  | { kind: "range"; low: number; high: number }
  | { kind: "text" };

export function parseAmount(text: string): ParsedAmount {
  const single = parseNumber(text);
  if (single !== null) return { kind: "number", value: single };
  const range = text.split(/\s*(?:-|–|\bto\b)\s*/);
  if (range.length === 2) {
    const [low, high] = range.map(parseNumber);
    if (low !== null && high !== null && low < high) return { kind: "range", low, high };
  }
  return { kind: "text" };
}

/**
 * ml per one of this unit, for liquid volume units we can convert; null
 * otherwise. Barspoons stay unconverted: in the Top 100 they measure xanthan
 * gum, a powder.
 */
export function mlPerUnit(unit: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (/^(fl\.? ?oz|fluid ounces?|oz|ounces?)$/.test(u)) return ML_PER_FL_OZ;
  if (/^(ml|millilit(re|er)s?)$/.test(u)) return 1;
  if (/^(cl|centilit(re|er)s?)$/.test(u)) return 10;
  if (/^(l|lit(re|er)s?)$/.test(u)) return 1000;
  if (/^(tsp|teaspoons?)$/.test(u)) return 5;
  if (/^(tbsp|tablespoons?)$/.test(u)) return 15;
  if (/^cups?$/.test(u)) return 8 * ML_PER_FL_OZ;
  return null;
}

/** Counted things round to whole numbers when scaled. */
const COUNTED = /^(dash(es)?|drops?|leaf|leaves|wedges?|sprigs?|slices?|twists?|pinch(es)?|each|whole|pieces?)$/i;
function isCounted(unit: string): boolean {
  return COUNTED.test(unit.trim());
}

const DENOMINATORS = [2, 3, 4, 6, 8, 12, 24];

/** 1.5 -> "1 1/2", 0.1667 -> "1/6", 2 -> "2"; odd values get up to 2 decimals. */
export function formatFraction(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  if (frac < 1e-6) return String(whole);
  for (const d of DENOMINATORS) {
    const num = Math.round(frac * d);
    if (num > 0 && num < d && Math.abs(num / d - frac) < 1e-6) {
      const g = gcd(num, d);
      const f = `${num / g}/${d / g}`;
      return whole > 0 ? `${whole} ${f}` : f;
    }
  }
  return String(Math.round(n * 100) / 100);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * ml without losing Difford's small amounts: to the nearest 0.25 ml below
 * 5 ml (1.25, 2.5), the nearest 0.5 ml above (7.5, 12.5, 22.5).
 */
export function formatMl(ml: number): string {
  const step = ml < 5 ? 4 : 2;
  return String(Number((Math.round(ml * step) / step).toFixed(2)));
}

/** Metric amounts keep decimals ("7.5 ml"); others use fractions ("1 1/2 fl oz"). */
function formatFor(unit: string, n: number): string {
  return /^(ml|cl|l|millilit|centilit|lit)/i.test(unit.trim()) ? formatMl(n) : formatFraction(n);
}

export interface DisplayAmount {
  amount: string;
  unit: string;
  /** A helper: "about 1 1/2 cups" for big batches, or "(×2)" when an amount couldn't be scaled. */
  note: string | null;
  /** True when a unit was converted (so the card can explain the 30 ml basis). */
  converted: boolean;
}

/**
 * The amount to show for one recipe line at `servings`, in `mode`.
 * "As written" at 1 serving is the recipe's text untouched; anything we
 * can't read (e.g. "Top up") is left as written.
 */
export function displayAmount(amount: string, unit: string, servings: number, mode: UnitMode): DisplayAmount {
  const asWritten: DisplayAmount = { amount, unit, note: null, converted: false };
  if (mode === "original" && servings === 1) return asWritten;
  const parsed = parseAmount(amount);
  if (parsed.kind === "text") {
    // A number we couldn't read: say plainly it wasn't scaled.
    return servings > 1 && /\d/.test(amount) ? { ...asWritten, note: `(×${servings})` } : asWritten;
  }

  const perUnit = mlPerUnit(unit);
  const values = (parsed.kind === "number" ? [parsed.value] : [parsed.low, parsed.high]).map((n) => n * servings);

  // Not convertible (dashes, drops, barspoons…), or "as written": scale only.
  if (perUnit === null || mode === "original") {
    const shown = values.map((n) => (isCounted(unit) ? String(Math.max(1, Math.round(n))) : formatFor(unit, n)));
    const count = isCounted(unit) ? Number(shown[shown.length - 1]) : values[values.length - 1];
    return { amount: shown.join("–"), unit: countNoun(unit, count), note: null, converted: false };
  }

  const ml = values.map((v) => v * perUnit);
  if (mode === "ml") {
    return { amount: ml.map(formatMl).join("–"), unit: "ml", note: null, converted: perUnit !== 1 };
  }
  const oz = ml.map((v) => v / ML_PER_FL_OZ);
  const ozTop = oz[oz.length - 1];
  const cups = Math.round((ozTop / 8) * 4) / 4;
  return {
    amount: oz.map(formatFraction).join("–"),
    unit: "fl oz",
    note: ozTop >= 8 ? `about ${formatFraction(cups)} ${cups > 1 ? "cups" : "cup"}` : null,
    converted: perUnit !== ML_PER_FL_OZ,
  };
}

const PLURALS: [string, string][] = [
  ["dash", "dashes"],
  ["drop", "drops"],
  ["barspoon", "barspoons"],
  ["wedge", "wedges"],
  ["pinch", "pinches"],
  ["leaf", "leaves"],
  ["sprig", "sprigs"],
  ["slice", "slices"],
  ["twist", "twists"],
  ["cup", "cups"],
  ["tablespoon", "tablespoons"],
  ["teaspoon", "teaspoons"],
  ["piece", "pieces"],
];

/** "dash"/"dashes" to match the amount shown (only for units we know; others stay as written). */
function countNoun(unit: string, n: number): string {
  const u = unit.trim();
  const lower = u.toLowerCase();
  for (const [one, many] of PLURALS) {
    if (lower === one || lower === many) return n > 1 ? many : one;
  }
  return u;
}

export function parseServings(value: string | string[] | undefined): number {
  const v = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(v) && v >= 1 && v <= MAX_SERVINGS ? v : 1;
}

/** Null when absent or not a mode we know (so the caller can fall back to the remembered one). */
export function parseUnitMode(value: string | string[] | undefined): UnitMode | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "oz" || v === "ml" || v === "original" ? v : null;
}
