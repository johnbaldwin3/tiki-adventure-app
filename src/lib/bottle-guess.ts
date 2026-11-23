/**
 * Guesses which catalog style a typed bottle name belongs to, from each
 * style's example brands ("Smith & Cross Jamaica Rum" -> the funky Jamaican
 * overproof style). Pure and catalog-agnostic so the typed-in bottle form
 * can run it in the browser as the taster types.
 */

export interface GuessableStyle {
  id: string;
  brands: string[];
}

/** Lowercase, accents off, "&"/"and" unified, punctuation to single spaces. */
export function normalizeName(s: string): string {
  return ` ${s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Shortest typed name worth guessing from (so "ra" doesn't match "Rare"). */
const MIN_TYPED = 4;

/**
 * The catalog style whose example brand best fits the typed name, or "" when
 * nothing fits or two styles fit equally well (better to leave it for the
 * taster than guess wrong). A brand fits when the typed name contains it as
 * whole words, or the typed name is the start of it ("Smith & Cr").
 * Longer brand matches win.
 */
export function guessStyle(typed: string, styles: GuessableStyle[]): string {
  const name = normalizeName(typed);
  if (name.trim().length < MIN_TYPED) return "";
  let best = 0;
  let winners = new Set<string>();
  for (const style of styles) {
    for (const brand of style.brands) {
      const b = normalizeName(brand);
      if (b.trim() === "") continue;
      let score = 0;
      if (name.includes(b)) score = b.length;
      else if (b.startsWith(name.trimEnd())) score = name.trim().length;
      if (score === 0) continue;
      if (score > best) {
        best = score;
        winners = new Set([style.id]);
      } else if (score === best) {
        winners.add(style.id);
      }
    }
  }
  return winners.size === 1 ? [...winners][0] : "";
}
