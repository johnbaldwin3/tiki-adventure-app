import { test, expect, type Page } from "@playwright/test";

// Fixture facts (seed-data/cocktails.json): Aged Jamaican rum is in 15
// drinks (6 tasted); Falernum in 17; both together only in Zombie; either
// in 31.
const list = (page: Page) => page.getByRole("list", { name: "Cocktails" }).getByRole("listitem");

async function addIngredient(page: Page, label: RegExp) {
  const select = page.getByLabel(/Pick an ingredient|Add another ingredient/);
  const value = await select.locator("option", { hasText: label }).first().getAttribute("value");
  await select.selectOption(value!);
  await page.getByRole("button", { name: "Add" }).click();
}

test("filter the list by one ingredient, then combine with Tasted", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Filter by ingredient").click();
  await addIngredient(page, /^Aged Jamaican rum \(funky\) — in 15$/);

  await expect(page).toHaveURL(/\/\?ing=aged-jamaican-rum$/);
  await expect(list(page)).toHaveCount(15);
  await expect(page.getByRole("status").filter({ hasText: "15 drinks match" })).toBeVisible();
  const filters = page.getByRole("navigation", { name: "Filter cocktails" });
  await expect(filters.getByRole("link", { name: /^All 15/ })).toBeVisible();

  await filters.getByRole("link", { name: /^Tasted 6/ }).click();
  await expect(page).toHaveURL(/\/\?show=tasted&ing=aged-jamaican-rum$/);
  await expect(list(page)).toHaveCount(6);
});

test("two ingredients: all-of vs any-of, remove and clear", async ({ page }) => {
  await page.goto("/?ing=aged-jamaican-rum");
  await addIngredient(page, /^Falernum liqueur/);
  await expect(page).toHaveURL(/\/\?ing=aged-jamaican-rum,falernum$/);
  await expect(list(page)).toHaveCount(1);
  await expect(list(page).first()).toContainText("Zombie");

  const matchNav = page.getByRole("navigation", { name: "Ingredient match" });
  await matchNav.getByRole("link", { name: "Any of these" }).click();
  await expect(page).toHaveURL(/match=any$/);
  await expect(list(page)).toHaveCount(31);

  await page.getByRole("link", { name: "Remove Falernum liqueur" }).click();
  await expect(page).toHaveURL(/\/\?ing=aged-jamaican-rum$/);
  await expect(page.getByLabel("Add another ingredient")).toBeFocused();
  await expect(list(page)).toHaveCount(15);

  await page.getByRole("link", { name: "Clear ingredients" }).click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(list(page)).toHaveCount(100);
});

test("the picker doesn't offer ingredients already chosen", async ({ page }) => {
  await page.goto("/?ing=navy-rum");
  const select = page.getByLabel("Add another ingredient");
  await expect(select.locator("option", { hasText: /^Navy rum/ })).toHaveCount(0);
  await expect(select.locator("option", { hasText: /^Falernum liqueur/ })).toHaveCount(1);
});

test("no-match message suggests switching to any-of", async ({ page }) => {
  await page.goto("/?ing=navy-rum,falernum");
  await expect(list(page)).toHaveCount(0);
  await expect(page.getByText(/No drinks here use all of those/)).toBeVisible();
});

test("unknown ingredient ids in the URL are ignored", async ({ page }) => {
  await page.goto("/?ing=unicorn-tears");
  await expect(list(page)).toHaveCount(100);
});

test("an ingredient page links to the filtered list", async ({ page }) => {
  await page.goto("/ingredients/navy-rum");
  await page.getByRole("link", { name: /Filter the list/ }).click();
  await expect(page).toHaveURL(/\/\?ing=navy-rum$/);
  await expect(list(page)).toHaveCount(5);
});

test("adding keeps the Tasted view and earlier choices, and focus returns to the picker", async ({ page }) => {
  await page.goto("/?show=untasted&ing=aged-jamaican-rum");
  await addIngredient(page, /^Falernum liqueur/);
  await expect(page).toHaveURL(/\/\?show=untasted&ing=aged-jamaican-rum,falernum$/);
  await expect(page.getByLabel("Add another ingredient")).toBeFocused();
});

test("tab links keep the ingredient filter", async ({ page }) => {
  await page.goto("/?ing=aged-jamaican-rum,falernum&match=any");
  const filters = page.getByRole("navigation", { name: "Filter cocktails" });
  await expect(filters.getByRole("link", { name: /^Not yet/ })).toHaveAttribute(
    "href",
    "/?show=untasted&ing=aged-jamaican-rum,falernum&match=any"
  );
});

test("an invalid ?add= is dropped via redirect", async ({ page }) => {
  await page.goto("/?add=unicorn-tears");
  await expect.poll(() => new URL(page.url()).search).toBe("");
  await expect(list(page)).toHaveCount(100);
});

test("any-of empty state wording", async ({ page }) => {
  // Only untasted drinks (3 Monkeys & a dash, Vacation Martini) use these.
  await page.goto("/?show=tasted&ing=new-make-spirit,vanilla-vodka&match=any");
  await expect(page.getByText("No drinks here use any of those among the tasted ones.")).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the Add button still filters", async ({ page }) => {
    await page.goto("/?ing=aged-jamaican-rum");
    const select = page.getByLabel("Add another ingredient");
    const value = await select.locator("option", { hasText: /^Falernum liqueur/ }).getAttribute("value");
    await select.selectOption(value!);
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page).toHaveURL(/\/\?ing=aged-jamaican-rum,falernum$/);
    await expect(list(page)).toHaveCount(1);
  });
});
