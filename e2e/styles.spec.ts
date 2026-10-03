import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { JOHN, MOCK_URL, signIn } from "./auth";

// Saves style fixes, so it runs in the serial "recipes" project and resets around itself.
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-collections`);
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-collections`);
});

const list = (page: Page) => page.getByRole("list", { name: "Cocktails" }).getByRole("listitem");

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

test("filter by style: toggle tags, combine them, keep the collection", async ({ page }) => {
  await page.goto("/?c=classics");
  await page.getByText("Filter by style").click();
  await page.getByRole("group", { name: "Build" }).getByRole("link", { name: /^Spirit-forward/ }).click();
  await expect(page).toHaveURL(/\/\?c=classics&style=spirit-forward$/);
  await expect(list(page).filter({ hasText: "Negroni" })).toHaveCount(1);
  await expect(list(page).filter({ hasText: "Daiquiri" })).toHaveCount(0);

  await page.getByRole("group", { name: "Base" }).getByRole("link", { name: /^Gin/ }).click();
  await expect(page).toHaveURL(/\/\?c=classics&style=spirit-forward,gin$/);
  const names = await list(page).allTextContents();
  expect(names.some((n) => n.includes("Dry Martini"))).toBe(true);
  expect(names.some((n) => n.includes("Manhattan"))).toBe(false);
  await expect(page.getByRole("status").filter({ hasText: /drinks? match/ })).toBeVisible();
  await expectAccessible(page);

  // A chosen tag toggles off; "Clear styles" empties them.
  await page.getByRole("link", { name: /Gin \(chosen; select to remove\)/ }).click();
  await expect(page).toHaveURL(/\/\?c=classics&style=spirit-forward$/);
  await page.getByRole("link", { name: "Clear styles" }).click();
  await expect(page).toHaveURL(/\/\?c=classics$/);

  // Unknown tags are dropped from the URL.
  await page.goto("/?style=bogus,smoky");
  await expect(page).toHaveURL(/\/\?style=smoky$/);
  await expect(list(page).filter({ hasText: "Naked and Famous" })).toHaveCount(1);
});

test("a recipe card shows its style tags; tasters can fix them", async ({ page }) => {
  await page.goto("/cocktails/negroni");
  const panel = page.getByRole("region", { name: "Style" });
  await expect(panel.getByRole("list", { name: "Style tags for Negroni" }).getByRole("link")).toHaveText([
    "Spirit-forward (see all drinks tagged this)",
    "Gin (see all drinks tagged this)",
    "Bitter (see all drinks tagged this)",
  ]);
  await expect(panel.getByText("Worked out from the recipe.")).toBeVisible();
  await expect(panel.getByText("Fix style tags")).toHaveCount(0);
  await panel.getByRole("link", { name: /^Bitter/ }).click();
  await expect(page).toHaveURL(/\/\?style=bitter$/);

  await signIn(page, JOHN, "/cocktails/negroni");
  await panel.getByText("Fix style tags").click();
  // One build (radio buttons), any number of flavors.
  await expect(panel.getByRole("radio", { name: "Spirit-forward" })).toBeChecked();
  await panel.getByRole("checkbox", { name: "Herbal" }).check();
  await panel.getByRole("checkbox", { name: "Bitter" }).uncheck();
  await panel.getByRole("button", { name: "Save style tags" }).click();
  await expect(page).toHaveURL(/\/cocktails\/negroni\?styles=saved#style$/);
  await expect(panel.getByRole("status")).toHaveText("Style tags saved.");
  await expect(panel.getByRole("list", { name: "Style tags for Negroni" }).getByRole("link")).toHaveText([
    "Spirit-forward (see all drinks tagged this)",
    "Gin (see all drinks tagged this)",
    "Herbal (see all drinks tagged this)",
  ]);
  await expect(panel.getByText("Worked out from the recipe, with our fixes.")).toBeVisible();
  await panel.getByText("Fix style tags").click();
  await expect(panel.getByText("(our fix)")).toHaveCount(2);
  // Switching the build is one choice.
  await panel.getByRole("radio", { name: "Aperitif" }).check();
  await expect(panel.getByRole("radio", { name: "Spirit-forward" })).not.toBeChecked();
  await page.reload();
  await expectAccessible(page);

  // The list follows the fix.
  await page.goto("/?style=herbal&q=negroni");
  await expect(list(page)).toHaveCount(1);

  // Back to the computed tags.
  await page.goto("/cocktails/negroni");
  await panel.getByText("Fix style tags").click();
  await panel.getByRole("checkbox", { name: "Herbal" }).uncheck();
  await panel.getByRole("checkbox", { name: "Bitter" }).check();
  await panel.getByRole("button", { name: "Save style tags" }).click();
  await expect(panel.getByText("Worked out from the recipe.")).toBeVisible();
});
