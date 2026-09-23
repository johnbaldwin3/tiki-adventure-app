import { beforeEach, describe, expect, it, vi } from "vitest";

// The action must re-check everything itself (Server Actions can be POSTed
// to directly): valid input, a signed-in user, and that it's their own
// tasting -- and only then write, as that user (so RLS applies too).
type User = { email: string; taster: { id: string; initials: string; displayName: string } | null } | null;
let signedIn: User = null;
vi.mock("@/lib/auth/current-taster", () => ({ getSignedInUser: async () => signedIn }));

const upsert = vi.fn<(row: unknown, opts: unknown) => Promise<{ error: unknown }>>(async () => ({ error: null }));
const createSupabaseServerClient = vi.fn(async () => ({ from: () => ({ upsert }) }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServerClient }));

let cocktailLookup: { data: unknown; error: unknown } = { data: { id: "c1" }, error: null };
vi.mock("@/lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => cocktailLookup }) }) }) },
}));
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

  it("refuses to save someone else's tasting", async () => {
    const s = await saveTasting(prev, form({ ...valid, taster: "gm" }));
    expect(s.status).toBe("error");
    expect(s.message).toMatch(/only save your own/);
    expect(upsert).not.toHaveBeenCalled();
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
