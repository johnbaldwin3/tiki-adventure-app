import { test, expect } from "@playwright/test";

test("home page loads and shows the tasting progress summary", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Adventures in Tiki/i })
  ).toBeVisible();

  // Progress summary shows "X / 100" tasted count.
  await expect(page.getByText(/\/ 100/)).toBeVisible();

  // At least one tasted cocktail is listed.
  await expect(page.getByText("Tiki Max")).toBeVisible();

  // Credit to the source is present.
  await expect(
    page.getByRole("link", { name: /Difford's Guide/i })
  ).toBeVisible();
});

test("home page is usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Adventures in Tiki/i })
  ).toBeVisible();

  // No horizontal overflow at phone width.
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});
