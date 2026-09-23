import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Guard the one thing that matters most before Phase 7 sign-in: the Server
// Action must never reach the service-role client unless writes are enabled.
const createAdminClient = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

// Anon client used for the id lookups.
const lookups: Record<string, { data: unknown; error: unknown }> = {};
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => lookups[table] }) }),
    }),
  },
}));

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

beforeEach(() => {
  vi.unstubAllEnvs();
  createAdminClient.mockReset();
  redirect.mockClear();
  lookups.cocktails = { data: { id: "c1" }, error: null };
  lookups.tasters = { data: { id: "t1" }, error: null };
});
afterEach(() => vi.unstubAllEnvs());

describe("saveTasting", () => {
  it("returns preview (and never touches the service-role client) when writes are off", async () => {
    vi.stubEnv("TASTING_WRITES_ENABLED", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const state = await saveTasting(prev, form(valid));
    expect(state.status).toBe("preview");
    expect(state.submission).toBe(1);
    expect(state.values.rating).toBe("8.5");
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("stays in preview on Vercel even with both vars set", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("TASTING_WRITES_ENABLED", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    expect((await saveTasting(prev, form(valid))).status).toBe("preview");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns field errors without writing", async () => {
    vi.stubEnv("TASTING_WRITES_ENABLED", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const state = await saveTasting(prev, form({ ...valid, rating: "12" }));
    expect(state.status).toBe("invalid");
    expect(state.errors.rating).toBeDefined();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed slug or taster", async () => {
    vi.stubEnv("TASTING_WRITES_ENABLED", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    expect((await saveTasting(prev, form({ ...valid, slug: "../x" }))).status).toBe("error");
    expect((await saveTasting(prev, form({ ...valid, taster: "j1" }))).status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns an error when the cocktail doesn't exist", async () => {
    vi.stubEnv("TASTING_WRITES_ENABLED", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    lookups.cocktails = { data: null, error: null };
    expect((await saveTasting(prev, form(valid))).status).toBe("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("upserts every field on the (cocktail, taster) key, then redirects to the card", async () => {
    vi.stubEnv("TASTING_WRITES_ENABLED", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    const upsert = vi.fn(async () => ({ error: null }));
    createAdminClient.mockReturnValue({ from: () => ({ upsert }) });

    await expect(saveTasting(prev, form(valid))).rejects.toThrow("REDIRECT:/cocktails/tiki-max#tasting");
    expect(upsert).toHaveBeenCalledWith(
      { cocktail_id: "c1", taster_id: "t1", tried: true, rating: 8.5, tasted_at: null, notes: "Nice" },
      { onConflict: "cocktail_id,taster_id" }
    );
  });

  it("reports a failed write without redirecting", async () => {
    vi.stubEnv("TASTING_WRITES_ENABLED", "true");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "k");
    createAdminClient.mockReturnValue({
      from: () => ({ upsert: async () => ({ error: { message: "boom" } }) }),
    });
    const state = await saveTasting(prev, form(valid));
    expect(state.status).toBe("error");
    expect(redirect).not.toHaveBeenCalled();
  });
});
