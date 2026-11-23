import { test, expect, type Page } from "@playwright/test";

const list = (page: Page) => page.getByRole("list", { name: "Cocktails" }).getByRole("listitem");

test("back from a card keeps the list's filters and scroll position", async ({ page }) => {
  await page.goto("/?show=untasted");
  const row = list(page).nth(40).getByRole("link");
  await row.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(500);
  const name = (await row.locator("span.font-semibold").first().textContent())!.trim();
  const href = (await row.getAttribute("href"))!;
  await row.click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  await page.getByRole("link", { name: "Back to the list" }).click();
  await expect(page).toHaveURL(/\/\?show=untasted$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 50);
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before + 50);
  await expect(page.locator(`ul[aria-label="Cocktails"] a[href="${href}"]`)).toBeFocused();
});

test("the browser's back button also lands where we were", async ({ page }) => {
  await page.goto("/");
  const row = list(page).nth(60).getByRole("link");
  await row.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await row.click();
  await expect(page.getByRole("link", { name: "All cocktails" })).toBeVisible();
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 50);
});

test("a card opened directly goes back to the full list at the top", async ({ page }) => {
  await page.goto("/cocktails/zombie");
  await page.getByRole("link", { name: "All cocktails" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(list(page).first()).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
});
