import { describe, expect, it } from "vitest";
import {
  NOTES_MAX_LENGTH,
  parseTastingForm,
  readTastingForm,
  tastingWritesEnabled,
  todayInEastern,
  type TastingFormValues,
} from "./tasting-form";

const TODAY = "2026-09-23";
const base: TastingFormValues = { tried: true, rating: "", tastedAt: "", notes: "" };
const parse = (v: Partial<TastingFormValues>) => parseTastingForm({ ...base, ...v }, TODAY);

describe("readTastingForm", () => {
  it("reads FormData fields, treating a missing checkbox as not tried", () => {
    const fd = new FormData();
    fd.set("rating", "8.5");
    fd.set("notes", "Yum");
    expect(readTastingForm(fd)).toEqual({ tried: false, rating: "8.5", tastedAt: "", notes: "Yum" });
    fd.set("tried", "on");
    expect(readTastingForm(fd).tried).toBe(true);
  });
});

describe("parseTastingForm", () => {
  it("accepts a full, valid entry and normalizes it", () => {
    expect(parse({ rating: " 8.75 ", tastedAt: "2026-09-20", notes: "  Great  " })).toEqual({
      ok: true,
      value: { tried: true, rating: 8.75, tastedAt: "2026-09-20", notes: "Great" },
    });
  });

  it("turns blank fields into nulls", () => {
    expect(parse({})).toEqual({
      ok: true,
      value: { tried: true, rating: null, tastedAt: null, notes: null },
    });
  });

  it.each(["0", "10", "9.4", "7.25", "10.00", "8.", ".5"])("accepts rating %s", (rating) => {
    expect(parse({ rating }).ok).toBe(true);
  });

  it("accepts a comma decimal from phone keyboards", () => {
    expect(parse({ rating: "8,5" })).toMatchObject({ ok: true, value: { rating: 8.5 } });
  });

  it.each(["10.01", "11", "-1", "8.555", "abc", ".", "", "1e1", "1.2.3"].filter(Boolean))("rejects rating %s", (rating) => {
    const r = parse({ rating });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.rating).toMatch(/0 to 10/);
  });

  it.each(["2026-02-30", "2026-13-01", "09/20/2026", "yesterday"])("rejects date %s", (tastedAt) => {
    const r = parse({ tastedAt });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.tastedAt).toBe("Enter a valid date.");
  });

  it("rejects a future date but allows today", () => {
    expect(parse({ tastedAt: "2026-09-24" }).ok).toBe(false);
    expect(parse({ tastedAt: TODAY }).ok).toBe(true);
  });

  it("enforces the notes length limit on the trimmed text", () => {
    expect(parse({ notes: "a".repeat(NOTES_MAX_LENGTH) + "   " }).ok).toBe(true);
    const r = parse({ notes: "a".repeat(NOTES_MAX_LENGTH + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.notes).toMatch(/at most 2000/);
  });

  it("normalizes CRLF line breaks before measuring and storing notes", () => {
    const lines = Array(1000).fill("a").join("\r\n"); // 1999 chars as LF, 2998 as CRLF
    const r = parse({ notes: lines });
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.value.notes).toBe(Array(1000).fill("a").join("\n"));
  });

  it("rejects a rating or date on an untried cocktail, but allows notes", () => {
    const withRating = parse({ tried: false, rating: "8" });
    expect(withRating.ok).toBe(false);
    if (!withRating.ok) expect(withRating.errors.tried).toMatch(/rating/);

    const withDate = parse({ tried: false, tastedAt: "2026-09-01" });
    expect(withDate.ok).toBe(false);
    if (!withDate.ok) expect(withDate.errors.tried).toMatch(/date/);

    expect(parse({ tried: false, notes: "Want to try this one" })).toEqual({
      ok: true,
      value: { tried: false, rating: null, tastedAt: null, notes: "Want to try this one" },
    });
  });

  it("reports every field error at once", () => {
    const r = parse({ rating: "12", tastedAt: "nope", notes: "x".repeat(NOTES_MAX_LENGTH + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["notes", "rating", "tastedAt"]);
  });
});

describe("todayInEastern", () => {
  it("uses US Eastern time, not UTC", () => {
    // 02:00 UTC on Sep 24 is still Sep 23 in New York (EDT, UTC-4).
    expect(todayInEastern(new Date("2026-09-24T02:00:00Z"))).toBe("2026-09-23");
    expect(todayInEastern(new Date("2026-09-24T05:00:00Z"))).toBe("2026-09-24");
  });
});

describe("tastingWritesEnabled", () => {
  it("is off unless both the flag and a service key are set", () => {
    expect(tastingWritesEnabled({})).toBe(false);
    expect(tastingWritesEnabled({ TASTING_WRITES_ENABLED: "true" })).toBe(false);
    expect(tastingWritesEnabled({ SUPABASE_SERVICE_ROLE_KEY: "k" })).toBe(false);
    expect(tastingWritesEnabled({ TASTING_WRITES_ENABLED: "1", SUPABASE_SERVICE_ROLE_KEY: "k" })).toBe(false);
    expect(tastingWritesEnabled({ TASTING_WRITES_ENABLED: "true", SUPABASE_SERVICE_ROLE_KEY: "k" })).toBe(true);
  });

  it("is always off on Vercel, even if both vars are set", () => {
    expect(
      tastingWritesEnabled({ VERCEL: "1", TASTING_WRITES_ENABLED: "true", SUPABASE_SERVICE_ROLE_KEY: "k" })
    ).toBe(false);
  });
});
