import { beforeEach, describe, expect, it, vi } from "vitest";

// The action must re-check everything itself (Server Actions can be POSTed
// to directly): valid input, a signed-in taster, a real cocktail and taster
// -- and only then write, as that user (so RLS applies too). Anyone in a
// household may save any of its tastings (migration 0016), never a friend's.
type User = { email: string; taster: { id: string; initials: string; displayName: string } | null } | null;
let signedIn: User = null;
vi.mock("@/lib/auth/current-taster", () => ({ getSignedInUser: async () => signedIn }));

const upsert = vi.fn<(row: unknown, opts: unknown) => Promise<{ error: unknown }>>(async () => ({ error: null }));
let existing: { data: unknown; error: unknown } = { data: [], error: null };
let cocktailLookup: { data: unknown; error: unknown } = { data: { id: "c1" }, error: null };
// JB and GM share a household; FR is a friend (visible, but not theirs to enter).
const TASTERS = [
  { id: "t-jb", initials: "JB", household_id: "h1" },
  { id: "t-gm", initials: "GM", household_id: "h1" },
  { id: "t-fr", initials: "FR", household_id: "h2" },
];
const createSupabaseServerClient = vi.fn(async () => ({
  from: (table: string) =>
    table === "tasters"
      ? { select: async () => ({ data: TASTERS, error: null }) }
      : table === "cocktails"
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => cocktailLookup }) }) }
        : { upsert, select: () => ({ eq: async () => existing }) },
}));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

const { saveTasting } = await import("./actions");

const prev = {
  status: "idle" as const,
  submission: 0,
  values: { tried: false, rating: "", tastedAt: "", notes: "" },
  errors: {},
  message: null,
};
function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const valid = { slug: "tiki-max", taster: "jb", tried: "on", rating: "8.5", notes: "Nice" };
const john = { email: "john@example.test", taster: { id: "t-jb", initials: "JB", displayName: "John" } };

beforeEach(() => {
  signedIn = john;
  cocktailLookup = { data: { id: "c1" }, error: null };
  existing = { data: [], error: null };
  upsert.mockClear();
  upsert.mockResolvedValue({ error: null });
  createSupabaseServerClient.mockClear();
  redirect.mockClear();
});

describe("saveTasting", () => {
  it("upserts the signed-in taster's own tasting as that user, then redirects to the card", async () => {
    await expect(saveTasting(prev, form(valid))).rejects.toThrow("REDIRECT:/cocktails/tiki-max#tasting");
    expect(createSupabaseServerClient).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      { cocktail_id: "c1", taster_id: "t-jb", tried: true, rating: 8.5, tasted_at: null, notes: "Nice" },
      { onConflict: "cocktail_id,taster_id" }
    );
  });

  it("refuses when nobody is signed in", async () => {
    signedIn = null;
    const s = await saveTasting(prev, form(valid));
    expect(s.status).toBe("error");
    expect(s.message).toMatch(/sign in again/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves the other taster's tasting too (entered by the signed-in taster)", async () => {
    await expect(saveTasting(prev, form({ ...valid, taster: "gm" }))).rejects.toThrow("REDIRECT:/cocktails/tiki-max#tasting");
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({ taster_id: "t-gm", rating: 8.5 });
  });

  it("refuses a friend's tasting (friends can be seen, not entered)", async () => {
    const s = await saveTasting(prev, form({ ...valid, taster: "fr" }));
    expect(s.status).toBe("error");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses an unknown taster", async () => {
    const s = await saveTasting(prev, form({ ...valid, taster: "zz" }));
    expect(s.status).toBe("error");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("'we both tried it' marks the other taster as tried, keeping their rating and date", async () => {
    await expect(saveTasting(prev, form({ ...valid, tastedAt: "2026-11-01", bothTried: "on" }))).rejects.toThrow("REDIRECT:");
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).toEqual({ cocktail_id: "c1", taster_id: "t-gm", tried: true, tasted_at: "2026-11-01" });

    upsert.mockClear();
    existing = { data: [{ taster_id: "t-gm", tried: false, tasted_at: "2026-10-01" }], error: null };
    await expect(saveTasting(prev, form({ ...valid, bothTried: "on" }))).rejects.toThrow("REDIRECT:");
    expect(upsert.mock.calls[1][0]).toEqual({ cocktail_id: "c1", taster_id: "t-gm", tried: true });

    // Already tried: nothing to do. Not tried yourself: no "both".
    upsert.mockClear();
    existing = { data: [{ taster_id: "t-gm", tried: true, tasted_at: null }], error: null };
    await expect(saveTasting(prev, form({ ...valid, bothTried: "on" }))).rejects.toThrow("REDIRECT:");
    expect(upsert).toHaveBeenCalledTimes(1);
    upsert.mockClear();
    await expect(saveTasting(prev, form({ slug: "tiki-max", taster: "jb", bothTried: "on" }))).rejects.toThrow("REDIRECT:");
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("says so if the other taster's mark couldn't be saved", async () => {
    upsert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "nope" } });
    await expect(saveTasting(prev, form({ ...valid, bothTried: "on" }))).rejects.toThrow("REDIRECT:/cocktails/tiki-max?tasting=partial#tasting");
  });

  it("refuses a signed-in account that isn't linked to a taster", async () => {
    signedIn = { email: "stranger@example.test", taster: null };
    expect((await saveTasting(prev, form(valid))).status).toBe("error");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns field errors without writing (and keeps the typed values)", async () => {
    const s = await saveTasting(prev, form({ ...valid, rating: "12" }));
    expect(s.status).toBe("invalid");
    expect(s.errors.rating).toBeDefined();
    expect(s.values.rating).toBe("12");
    expect(s.submission).toBe(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects a malformed slug or taster", async () => {
    expect((await saveTasting(prev, form({ ...valid, slug: "../x" }))).status).toBe("error");
    expect((await saveTasting(prev, form({ ...valid, taster: "j1" }))).status).toBe("error");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns an error when the cocktail doesn't exist", async () => {
    cocktailLookup = { data: null, error: null };
    expect((await saveTasting(prev, form(valid))).status).toBe("error");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("reports a rejected write (e.g. RLS) without redirecting", async () => {
    upsert.mockResolvedValueOnce({ error: { message: "new row violates row-level security policy" } });
    const s = await saveTasting(prev, form(valid));
    expect(s.status).toBe("error");
    expect(redirect).not.toHaveBeenCalled();
  });
});
