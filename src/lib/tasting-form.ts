/**
 * Pure validation for the "add rating & notes" form (Phase 4). Kept free of
 * Next/Supabase imports so it can be unit-tested and shared by the Server
 * Action and the form component.
 */

export const NOTES_MAX_LENGTH = 2000;

export interface TastingFormValues {
  tried: boolean;
  rating: string;
  tastedAt: string;
  notes: string;
}

export interface TastingUpdate {
  tried: boolean;
  rating: number | null;
  tastedAt: string | null;
  notes: string | null;
}

export type TastingFormErrors = Partial<Record<keyof TastingFormValues, string>>;

export type ParseResult =
  | { ok: true; value: TastingUpdate }
  | { ok: false; errors: TastingFormErrors };

/** Reads the raw form fields into strings/booleans (what the form echoes back on error). */
export function readTastingForm(form: { get(name: string): unknown }): TastingFormValues {
  const str = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  return {
    tried: form.get("tried") === "on",
    rating: str("rating"),
    tastedAt: str("tastedAt"),
    notes: str("notes"),
  };
}

// 0-10 with up to two decimals, matching the tastings.rating numeric(4,2)
// column. Also accepts "8." and ".5", which are easy to type on a phone pad.
const RATING_PATTERN = /^(\d{1,2}(\.\d{0,2})?|\.\d{1,2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(iso: string): boolean {
  if (!DATE_PATTERN.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  // Rejects things like 2026-02-30, which Date silently rolls over.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Validates the form. `today` (YYYY-MM-DD) is injected so tests don't
 * depend on the clock.
 *
 * Rules:
 *  - rating: optional; 0-10, up to 2 decimals (commas accepted as decimal
 *    point for phone keyboards)
 *  - tastedAt: optional; a real calendar date, not in the future
 *  - notes: optional; trimmed, at most NOTES_MAX_LENGTH characters. Notes
 *    are allowed on an untried cocktail (e.g. "want to try with Smith & Cross")
 *  - a rating or tasted date only makes sense if it's been tried, so either
 *    one with "tried" unchecked is an error rather than silently flipping it
 */
export function parseTastingForm(values: TastingFormValues, today: string): ParseResult {
  const errors: TastingFormErrors = {};

  let rating: number | null = null;
  const ratingText = values.rating.trim().replace(",", ".");
  if (ratingText !== "") {
    const n = Number(ratingText);
    if (!RATING_PATTERN.test(ratingText) || Number.isNaN(n) || n < 0 || n > 10) {
      errors.rating = "Enter a rating from 0 to 10 (up to 2 decimals, e.g. 8.75).";
    } else {
      rating = n;
    }
  }

  let tastedAt: string | null = null;
  const dateText = values.tastedAt.trim();
  if (dateText !== "") {
    if (!isRealDate(dateText)) {
      errors.tastedAt = "Enter a valid date.";
    } else if (dateText > today) {
      errors.tastedAt = "The tasting date can't be in the future.";
    } else {
      tastedAt = dateText;
    }
  }

  // Browsers submit textarea line breaks as CRLF; normalize so the length
  // check matches the textarea's own maxLength (which counts "\n" as 1).
  const notesText = values.notes.replace(/\r\n?/g, "\n").trim();
  if (notesText.length > NOTES_MAX_LENGTH) {
    errors.notes = `Keep notes to at most ${NOTES_MAX_LENGTH} characters (currently ${notesText.length}).`;
  }

  if (!values.tried && !errors.rating && ratingText !== "") {
    errors.tried = "Tick \"I've tried this\" to add a rating, or clear the rating.";
  } else if (!values.tried && !errors.tastedAt && dateText !== "") {
    errors.tried = "Tick \"I've tried this\" to add a tasting date, or clear the date.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { tried: values.tried, rating, tastedAt, notes: notesText === "" ? null : notesText },
  };
}

/** Today's date as YYYY-MM-DD in the tasters' timezone (US Eastern). */
export function todayInEastern(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
