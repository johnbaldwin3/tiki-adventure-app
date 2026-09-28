import { test, expect } from "@playwright/test";

// Runs against e2e/mock-supabase.mjs fixtures (seed-data/cocktails.json +
// iba-cocktails.json + collections.json): 196 drinks, 21 tasted (all in
// the Tiki collection, which has 103), Tiki Max is our #1 (avg 9.41).

test("home page loads as Equal Parts and shows the tasting progress summary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Equal Parts" })).toBeVisible();
  await expect(page.getByText("21 / 196")).toBeVisible();
  await expect(page.getByRole("link", { name: /Difford's Guide/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /IBA official cocktails/i })).toBeVisible();
});

test("list shows all drinks by default and filters to tasted / not yet", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("region", { name: "All drinks" }).getByRole("listitem");
  await expect(list).toHaveCount(196);

  const filters = page.getByRole("navigation", { name: "Filter cocktails" });
  await filters.getByRole("link", { name: /Tasted/ }).click();
  await expect(page).toHaveURL(/\?show=tasted$/);
  await expect(list).toHaveCount(21);
  // Best-rated first: Tiki Max is our #1.
  await expect(list.first()).toContainText("Tiki Max");
  await expect(list.first()).toContainText("9.41");

  await filters.getByRole("link", { name: /Not yet/ }).click();
  await expect(page).toHaveURL(/\?show=untasted$/);
  await expect(list).toHaveCount(175);
  await expect(page.getByRole("list", { name: "Cocktails" }).getByRole("link", { name: /Tiki Max/ })).toHaveCount(0);

  await filters.getByRole("link", { name: /^All/ }).click();
  await expect(list).toHaveCount(196);
});

test("collections: switch between them, keeping the other filters; Tiki keeps its look", async ({ page }) => {
  await page.goto("/?show=untasted");
  const nav = page.getByRole("navigation", { name: "Collections" });
  await expect(nav.getByRole("link", { name: /^All drinks 196/ })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: /^Classics 102/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /^Prohibition 18/ })).toBeVisible();

  await nav.getByRole("link", { name: /^Tiki 103/ }).click();
  await expect(page).toHaveURL(/\/\?c=tiki&show=untasted$/);
  await expect(page.getByRole("heading", { level: 1, name: /Adventures in Tiki/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tiki" }).getByRole("listitem")).toHaveCount(82);
  await expect(page.getByText("21 / 103")).toBeVisible();

  await nav.getByRole("link", { name: /^Classics/ }).click();
  await expect(page).toHaveURL(/\/\?c=classics&show=untasted$/);
  await page.getByRole("navigation", { name: "Filter cocktails" }).getByRole("link", { name: /^All/ }).click();
  await expect(page).toHaveURL(/\/\?c=classics$/);
  await expect(page.getByRole("heading", { level: 1, name: "Equal Parts" })).toBeVisible();
  await expect(page.getByText(/The IBA's official cocktails/)).toBeVisible();
  const classics = page.getByRole("region", { name: "Classics" }).getByRole("listitem");
  await expect(classics).toHaveCount(102);
  // IBA drinks are marked, not ranked; the Difford's overlaps keep their rank.
  await expect(classics.filter({ hasText: "Negroni" })).toContainText("IBA official cocktail");
  await expect(classics.filter({ hasText: "Jungle Bird" })).toContainText(/Difford's rank \d+/);

  // Search stays inside the collection.
  await page.getByLabel("Search by name, spirit or ingredient").fill("sour");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/\?c=classics&q=sour$/);
  await expect(classics.filter({ hasText: "Whiskey Sour" })).toHaveCount(1);
  await expect(classics.filter({ hasText: "Hawaiian Stone Sour" })).toHaveCount(0);
});

test("an unknown ?show= or ?c= value falls back to the full list", async ({ page }) => {
  await page.goto("/?show=bogus");
  await expect(page.getByRole("region", { name: "All drinks" }).getByRole("listitem")).toHaveCount(196);
  await page.goto("/?c=bogus&show=tasted");
  await expect(page).toHaveURL(/\/\?show=tasted$/);
  await expect(page.getByRole("region", { name: "All drinks" }).getByRole("listitem")).toHaveCount(21);
});

test("home page is usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Equal Parts" })).toBeVisible();
  await page.goto("/?c=tiki");
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});
