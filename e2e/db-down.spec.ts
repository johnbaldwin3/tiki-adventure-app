import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { JOHN, MOCK_URL, signIn } from "./auth";

// Every page must fail gracefully (friendly, accessible message; no crash,
// no misleading zeros) when Supabase is unreachable. Runs in the "db-down"
// Playwright project, after the others, because it flips the shared mock.
test.describe.configure({ mode: "serial" });

async function setDbDown(page: Page, down: boolean) {
  const res = await page.request.post(`${MOCK_URL}/__mock/db-down`, { data: { down } });
  expect(res.ok()).toBe(true);
}

async function expectAccessible(page: Page) {
  // Next streams <title> in after the body; wait for it so axe doesn't
  // scan a half-rendered page mid-navigation.
  await expect(page).toHaveTitle(/Adventures in Tiki/);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
}

test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/db-down`, { data: { down: true } });
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/db-down`, { data: { down: false } });
});

test("home shows a friendly error and no fake zeros", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load the tasting log" })).toBeVisible();
  await expect(page.getByText("0 / 0")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Filter cocktails" })).toHaveCount(0);
  await expectAccessible(page);
});

test("stats shows a friendly error", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load the stats" })).toBeVisible();
  await expectAccessible(page);
});

test("recipe card shows a friendly error with a way back", async ({ page }) => {
  await page.goto("/cocktails/tiki-max");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load this recipe" })).toBeVisible();
  await expect(page.getByRole("link", { name: /All cocktails/ })).toBeVisible();
  await expectAccessible(page);
});

test("edit page shows a friendly error with a way back", async ({ page }) => {
  // Auth still works while the database is "down".
  await setDbDown(page, false);
  await signIn(page, JOHN);
  await setDbDown(page, true);
  await page.goto("/cocktails/tiki-max/tasting/jb");
  await expect(page.getByRole("heading", { name: "Edit tasting" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load this tasting" })).toBeVisible();
  await expect(page.getByRole("link", { name: /All cocktails/ })).toBeVisible();
  await expectAccessible(page);
});
