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
  await expect(page).toHaveTitle(/Equal Parts/);
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
  await expect(page.getByRole("region", { name: "Try next" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Filter cocktails" })).toHaveCount(0);
  await expectAccessible(page);
});

test("stats shows a friendly error", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load the stats" })).toBeVisible();
  await expectAccessible(page);
});

test("ingredients pages still show the catalog, with a note", async ({ page }) => {
  await page.goto("/ingredients");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load which drinks" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Rum" })).toBeVisible();
  await expectAccessible(page);
  await page.goto("/ingredients/navy-rum");
  await expect(page.getByText("Pusser's Gunpowder Proof (54.5%)")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load the drinks" })).toBeVisible();
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

test("our bar shows a friendly error", async ({ page }) => {
  await setDbDown(page, false);
  await signIn(page, JOHN);
  await setDbDown(page, true);
  for (const path of ["/cabinet", "/cabinet/edit"]) {
    await page.goto(path);
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't load our bar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save our bar" })).toHaveCount(0);
    await expectAccessible(page);
  }
});

test("a failed bar save keeps what was ticked and typed", async ({ page }) => {
  await setDbDown(page, false);
  await signIn(page, JOHN, "/cabinet/edit");
  await page.goto("/cabinet/edit");
  await page.locator("summary", { hasText: "Rum ·" }).first().click();
  await page.getByRole("checkbox", { name: /^Navy rum/ }).check();
  await page.locator("#bottle-navy-rum").fill("Pusser's Blue Label");
  await setDbDown(page, true);
  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Saving failed" })).toBeFocused();
  await expect(page).toHaveURL(/\/cabinet\/edit$/);
  await expect(page.getByRole("checkbox", { name: /^Navy rum/ })).toBeChecked();
  await expect(page.locator("#bottle-navy-rum")).toHaveValue("Pusser's Blue Label");
  await expectAccessible(page);
});

test("the shopping list shows a friendly error", async ({ page }) => {
  await setDbDown(page, false);
  await signIn(page, JOHN);
  await setDbDown(page, true);
  await page.goto("/shopping");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load the shopping list" })).toBeVisible();
  await expectAccessible(page);
});

test("a failed shopping-list change says so", async ({ page }) => {
  await setDbDown(page, false);
  await signIn(page, JOHN, "/ingredients/falernum");
  await setDbDown(page, true);
  await page.getByRole("button", { name: "Add to shopping list", exact: true }).click();
  await expect(page).toHaveURL(/\/ingredients\/falernum\?shopping=error$/);
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't update the shopping list" })).toBeFocused();
  await expectAccessible(page);
});

test("what to try next shows a friendly error", async ({ page }) => {
  await page.goto("/next");
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load suggestions" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Suggestions" })).toHaveCount(0);
  await expectAccessible(page);
});
