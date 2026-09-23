import { test, expect } from "@playwright/test";

// Runs against e2e/mock-supabase.mjs fixtures (seed-data/cocktails.json):
// 21 tasted cocktails, Tiki Max is our #1 (JB & GM avg 9.41).

test("home page loads and shows the tasting progress summary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Adventures in Tiki/i })).toBeVisible();
  await expect(page.getByText("21 / 100")).toBeVisible();
  await expect(page.getByRole("link", { name: /Difford's Guide/i })).toBeVisible();
});

test("list shows all 100 by default and filters to tasted / not yet", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("region", { name: "The Top 100" }).getByRole("listitem");
  await expect(list).toHaveCount(100);

  const filters = page.getByRole("navigation", { name: "Filter cocktails" });
  await filters.getByRole("link", { name: /Tasted/ }).click();
  await expect(page).toHaveURL(/\?show=tasted$/);
  await expect(list).toHaveCount(21);
  // Best-rated first: Tiki Max is our #1.
  await expect(list.first()).toContainText("Tiki Max");
  await expect(list.first()).toContainText("9.41");

  await filters.getByRole("link", { name: /Not yet/ }).click();
  await expect(page).toHaveURL(/\?show=untasted$/);
  await expect(list).toHaveCount(79);
  await expect(page.getByRole("link", { name: /Tiki Max/ })).toHaveCount(0);

  await filters.getByRole("link", { name: /^All/ }).click();
  await expect(list).toHaveCount(100);
});

test("an unknown ?show= value falls back to the full list", async ({ page }) => {
  await page.goto("/?show=bogus");
  await expect(
    page.getByRole("region", { name: "The Top 100" }).getByRole("listitem")
  ).toHaveCount(100);
});

test("home page is usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Adventures in Tiki/i })).toBeVisible();
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});
