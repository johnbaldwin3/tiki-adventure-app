import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { MOCK_URL, signIn, JOHN } from "./auth";

// Changes collections, so it runs in the serial "recipes" project after the
// counting specs (see playwright.config.ts), and resets them around itself.
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-collections`);
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-collections`);
  await request.post(`${MOCK_URL}/__mock/reset-recipes`);
});

async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/Equal Parts/);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

test("an IBA drink: credited, in ml as IBA writes it, in Classics and Prohibition with its story", async ({ page }) => {
  await page.goto("/cocktails/sidecar");
  await expect(page.getByText("IBA official cocktail · The Unforgettables")).toBeVisible();
  const ingredients = page.getByRole("region", { name: "Ingredients" });
  await expect(ingredients.getByText("50 ml")).toBeVisible();
  await expect(ingredients.getByRole("link", { name: "Cognac", exact: true })).toHaveAttribute("href", "/ingredients/cognac");
  await expect(page.getByRole("link", { name: /see IBA's page/ })).toHaveAttribute(
    "href",
    "https://iba-world.com/iba-cocktail/sidecar/"
  );

  const panel = page.getByRole("region", { name: "Collections" });
  await expect(panel.getByRole("list", { name: "Collections with Sidecar" }).getByRole("link")).toHaveText([
    "Classics",
    "Prohibition",
  ]);
  await expect(panel.getByText(/Prohibition:.*First printed in 1922/)).toBeVisible();
  await expect(panel.getByRole("link", { name: /Source for the Prohibition note/ })).toHaveAttribute(
    "href",
    /diffordsguide\.com/
  );
  // Signed out: no editing.
  await expect(panel.getByText("Change collections")).toHaveCount(0);
  await expectAccessible(page);

  await panel.getByRole("link", { name: "Prohibition", exact: true }).click();
  await expect(page).toHaveURL(/\/\?c=prohibition$/);
  await expect(page.getByRole("region", { name: "Prohibition" }).getByRole("listitem")).toHaveCount(18);
});

test("a Difford's tiki drink also on the IBA list keeps the tiki look and says so", async ({ page }) => {
  await page.goto("/cocktails/zombie");
  await expect(page.locator("header.tiki-header")).toBeVisible();
  const panel = page.getByRole("region", { name: "Collections" });
  await expect(panel.getByRole("link", { name: "Tiki" })).toBeVisible();
  await expect(panel.getByText(/On the IBA list as “Zombie”; this is Difford's recipe/)).toBeVisible();
  await page.goto("/cocktails/negroni");
  await expect(page.locator("header.bar-header")).toBeVisible();
});

test("tasters put a drink in collections from its card", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/negroni");
  const panel = page.getByRole("region", { name: "Collections" });
  await panel.getByText("Change collections").click();
  await expect(panel.getByRole("checkbox", { name: "Classics" })).toBeChecked();
  await panel.getByRole("checkbox", { name: "Prohibition" }).check();
  await panel.getByRole("button", { name: "Save collections" }).click();
  await expect(page).toHaveURL(/\/cocktails\/negroni\?collections=saved#collections$/);
  await expect(panel.getByRole("status")).toHaveText("Collections saved.");
  await expect(panel.getByRole("status")).toBeFocused();
  await expect(panel.getByRole("list", { name: "Collections with Negroni" }).getByRole("link")).toHaveText([
    "Classics",
    "Prohibition",
  ]);
  await expectAccessible(page);

  // And out again.
  await panel.getByText("Change collections").click();
  await panel.getByRole("checkbox", { name: "Classics" }).uncheck();
  await panel.getByRole("checkbox", { name: "Prohibition" }).uncheck();
  await panel.getByRole("button", { name: "Save collections" }).click();
  await expect(panel.getByText("Not in any collection yet.")).toBeVisible();
  await page.goto("/?c=classics&q=negroni");
  await expect(page.getByText("No drinks match “negroni”.")).toBeVisible();
});

test("add, rename and remove a collection; built-in ones can't be removed", async ({ page }) => {
  await signIn(page, JOHN, "/collections");
  await expect(page.getByRole("heading", { level: 1, name: "Collections" })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel("Name", { exact: true }).last().fill("Tiki");
  await page.getByRole("button", { name: "Add collection" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Another collection already has that name");

  await page.getByLabel("Name", { exact: true }).last().fill("Date night");
  await page.getByLabel(/Description/).last().fill("For the two of us.");
  await page.getByRole("button", { name: "Add collection" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Collection added.");
  const item = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Date night" }) });
  await expect(item).toContainText("0 drinks");
  await expect(item).toContainText("For the two of us.");

  // It shows up on the home page and on the recipe form, ticked when adding from it.
  await page.goto("/?c=date-night");
  await expect(page.getByRole("navigation", { name: "Collections" }).getByRole("link", { name: /^Date night 0/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await page.getByRole("link", { name: "+ Add a recipe" }).click();
  await expect(page).toHaveURL(/\/cocktails\/new\?c=date-night$/);
  await page.getByRole("button", { name: "Or type it in yourself" }).click();
  await expect(page.getByRole("checkbox", { name: "Date night" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Tiki" })).not.toBeChecked();
  await page.getByLabel("Name", { exact: true }).fill("Candlelight Sour");
  const first = page.getByRole("group", { name: "Ingredient 1" });
  await first.getByLabel("Amount").fill("2");
  await first.getByLabel("Unit").fill("fl oz");
  await first.getByLabel("Ingredient", { exact: true }).fill("Bourbon");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page).toHaveURL(/\/cocktails\/candlelight-sour\?recipe=added$/);
  await expect(
    page.getByRole("region", { name: "Collections" }).getByRole("list", { name: "Collections with Candlelight Sour" }).getByRole("link")
  ).toHaveText(["Date night"]);

  // Rename (the URL stays the same).
  await page.goto("/collections");
  await item.getByText(/^Rename or describe/).click();
  await item.getByLabel("Name").fill("Date nights");
  await item.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Collection saved.");
  const renamed = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Date nights" }) });
  await expect(renamed.getByRole("link", { name: "Date nights" })).toHaveAttribute("href", "/?c=date-night");
  await expect(renamed).toContainText("1 drink");

  // Built-in collections can't be removed; a clashing rename is refused, with its form left open.
  const tiki = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Tiki", exact: true }) });
  await tiki.getByText(/^Rename or describe/).click();
  await tiki.getByLabel("Name").fill("Classics");
  await tiki.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Another collection already has that name");
  await expect(tiki.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true }).last()).toHaveValue("");
  await expect(tiki.getByText(/can.t be removed/)).toBeVisible();
  await expect(tiki.getByRole("button", { name: /Remove collection/ })).toHaveCount(0);

  // Remove ours (the drink stays).
  await renamed.getByText(/^Rename or describe/).click();
  await renamed.getByRole("checkbox", { name: /Yes, remove Date nights/ }).check();
  await renamed.getByRole("button", { name: /Remove collection/ }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Collection removed");
  await expect(page.getByRole("link", { name: "Date nights" })).toHaveCount(0);
  await page.goto("/cocktails/candlelight-sour");
  await expect(page.getByRole("heading", { level: 1, name: "Candlelight Sour" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Collections" }).getByText("Not in any collection yet.")).toBeVisible();
});

test("signed out, the collections page is read-only", async ({ page }) => {
  await page.goto("/collections");
  await expect(page.getByRole("link", { name: "Tiki", exact: true })).toBeVisible();
  await expect(page.getByText(/^Rename or describe/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add collection" })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fcollections");
});
