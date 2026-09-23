import { test, expect } from "@playwright/test";

test("tapping a cocktail opens its full recipe card, and Back returns to the list", async ({ page }) => {
  await page.goto("/?show=tasted");
  await page.getByRole("link", { name: /Tiki Max/ }).click();

  await expect(page).toHaveURL(/\/cocktails\/tiki-max$/);
  await expect(page).toHaveTitle(/Tiki Max/);
  await expect(page.getByRole("heading", { level: 1, name: "Tiki Max" })).toBeVisible();

  // Recipe sections
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  const ingredients = page.getByRole("region", { name: "Ingredients" }).getByRole("listitem");
  expect(await ingredients.count()).toBeGreaterThan(2);
  await expect(page.getByRole("heading", { name: "Glass" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Garnish" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Method" })).toBeVisible();

  // Our tasting: both tasters, ratings and notes from the fixtures
  const tasting = page.getByRole("region", { name: "Our tasting" });
  await expect(tasting.getByText("John")).toBeVisible();
  await expect(tasting.getByText("Genny")).toBeVisible();
  await expect(tasting.getByText(/Quintessential tiki flavor/)).toBeVisible();
  await expect(page.getByText(/9\.41 avg · our #1/)).toBeVisible();

  // Credit + link back to the original recipe
  const credit = page.getByRole("link", { name: /see the original recipe/i });
  await expect(credit).toHaveAttribute("href", /diffordsguide\.com\/cocktails\/recipe\//);
  await expect(credit).toHaveAttribute("target", "_blank");

  await page.getByRole("link", { name: /All cocktails/ }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("the tasting-notes link jumps to the Our tasting section", async ({ page }) => {
  await page.goto("/cocktails/tiki-max");
  await page.getByRole("link", { name: /Our tasting notes/ }).click();
  await expect(page).toHaveURL(/#tasting$/);
  await expect(page.getByRole("heading", { name: "Our tasting" })).toBeInViewport();
});

test("an untasted cocktail's card says so for both tasters", async ({ page }) => {
  await page.goto("/cocktails/zombie");
  await expect(page.getByRole("heading", { level: 1, name: "Zombie" })).toBeVisible();
  const tasting = page.getByRole("region", { name: "Our tasting" });
  await expect(tasting.getByText("Not tasted yet")).toHaveCount(2);
  await expect(page.getByText(/avg ·/)).toHaveCount(0);
});

test("a cocktail with accents and punctuation in its name resolves by slug", async ({ page }) => {
  await page.goto("/cocktails/pres-du-quai");
  await expect(page.getByRole("heading", { level: 1, name: "Près du Quai" })).toBeVisible();
});

test("an unknown slug shows a friendly 404", async ({ page }) => {
  // Soft 404: loading.tsx makes the card stream, so the status is already
  // 200 when notFound() runs (documented Next.js behavior); Next adds a
  // noindex meta instead. We assert the not-found UI, not the status code.
  await page.goto("/cocktails/not-a-real-drink");
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "Cocktail not found" })).toBeVisible();
  await page.getByRole("link", { name: "Back to all cocktails" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("recipe card has no horizontal scroll at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/cocktails/humuhumunukunukuapuaa");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});

test("a tried-but-unrated cocktail's card says so and shows no average", async ({ page }) => {
  await page.goto("/cocktails/nuka-nuka");
  const tasting = page.getByRole("region", { name: "Our tasting" });
  await expect(tasting.getByText("Tried — not rated yet")).toHaveCount(2);
  await expect(page.getByText(/avg ·|\d avg/)).toHaveCount(0);
});

test("a malformed slug 404s", async ({ page }) => {
  await page.goto("/cocktails/wp-login.php");
  await expect(page.getByRole("heading", { name: "Cocktail not found" })).toBeVisible();
});
