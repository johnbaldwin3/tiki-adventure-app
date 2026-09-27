import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { GENNY, JOHN, MOCK_URL, signIn } from "./auth";

// Runs in its own Playwright project after the others (it changes the
// list they count), one test after another. The AI recipe helper talks to
// the mock's OpenRouter stand-in (canned answers; see e2e/mock-recipes.mjs).
test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-recipes`);
  // Start from an empty bar (other specs stock it).
  await request.post(`${MOCK_URL}/__mock/reset-shared`);
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-recipes`);
});

// Fail on React hydration errors (ids differing between server and browser, etc.).
test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error" && /hydrat|did not match/i.test(msg.text())) throw new Error(msg.text());
  });
});

async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/Adventures in Tiki/);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

// A 2x2 PNG, enough for the browser to decode and resize.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64"
);

test("signed out, adding a recipe asks you to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "+ Add a recipe" })).toHaveCount(0);
  await page.goto("/cocktails/new");
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?next=%2Fcocktails%2Fnew"
  );
});

test("paste text: the helper drafts it, we review and save", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/new");
  await expect(page.getByRole("heading", { level: 1, name: "Add a recipe" })).toBeVisible();
  await expectAccessible(page);

  // Nothing there -> a clear message.
  await page.getByText("Paste text", { exact: true }).click();
  await page.getByLabel("Recipe text").fill("NO RECIPE HERE, just a shopping list");
  await page.getByRole("button", { name: "Read the recipe" }).click();
  const none = page.getByRole("alert").filter({ hasText: "Couldn't find a cocktail recipe there." });
  await expect(none).toBeVisible();
  await expect(none).toBeFocused();

  await page.getByLabel("Recipe text").fill("2 oz navy rum\n1 oz pineapple\n3/4 oz lime");
  await page.getByRole("button", { name: "Read the recipe" }).click();
  const review = page.getByRole("heading", { name: "Check the recipe, then save" });
  await expect(review).toBeFocused();
  await expect(page.getByLabel("Name")).toHaveValue("Test Swizzle");
  await expect(page.getByRole("group", { name: /^Ingredient \d$/ })).toHaveCount(4);
  const first = page.getByRole("group", { name: "Ingredient 1" });
  await expect(first.getByLabel("Amount")).toHaveValue("2");
  await expect(first.getByLabel("Unit")).toHaveValue("fl oz");
  await expect(first.getByLabel("Style in our catalog")).toHaveValue("navy-rum");
  // An id the catalog doesn't know is dropped, not trusted.
  await expect(page.getByRole("group", { name: "Ingredient 4" }).getByLabel("Style in our catalog")).toHaveValue("");
  await expectAccessible(page);

  await page.getByLabel("Garnish").fill("Mint sprig and a paper umbrella");
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page).toHaveURL(/\/cocktails\/test-swizzle\?recipe=added$/);
  await expect(page.getByRole("status")).toHaveText("Recipe added to our list.");
  await expect(page.getByText("Our recipe · added by JB")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Test Swizzle" })).toBeVisible();
  await expect(page.getByText("Mint sprig and a paper umbrella")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Ingredients" }).getByRole("listitem").getByRole("link", { name: "Navy rum", exact: true })
  ).toHaveAttribute("href", "/ingredients/navy-rum");
  // Its ingredients are understood by our bar.
  await expect(page.getByText(/Missing from our bar:.*Navy rum/)).toBeVisible();
  await expect(page.getByText(/Added by us/)).toBeVisible();
  await expect(page.getByText(/Difford's Guide/)).toHaveCount(0);

  // It's in the list, the search, and the ingredient pages.
  await page.goto("/?q=swizzle");
  await expect(page.getByRole("heading", { name: "The Top 100 + our recipes" })).toBeVisible();
  const row = page.getByRole("list", { name: "Cocktails" }).getByRole("link", { name: /Test Swizzle/ });
  await expect(row).toContainText("Our recipe");
  await page.goto("/ingredients/navy-rum");
  await expect(page.getByRole("link", { name: /Test Swizzle/ })).toBeVisible();
});

test("link: the page is fetched (following a redirect) and read", async ({ page, request }) => {
  await signIn(page, JOHN, "/cocktails/new");
  await page.getByText("Link", { exact: true }).click();
  await page.getByLabel("Link to the recipe").fill(`${MOCK_URL}/__mock/redirect-to-page`);
  await page.getByRole("button", { name: "Read the recipe" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Link Swizzle");
  await expect(page.getByLabel(/^Link/)).toHaveValue(`${MOCK_URL}/__mock/recipe-page`);

  // The helper got the page's structured recipe and text, not its scripts.
  const sent = await (await request.get(`${MOCK_URL}/__mock/last-openrouter`)).json();
  const prompt = JSON.stringify(sent.messages);
  expect(prompt).toContain("Structured recipe data");
  expect(prompt).toContain("2 oz navy rum");
  expect(prompt).not.toContain("tracking");
  expect(sent.response_format.type).toBe("json_schema");

  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page).toHaveURL(/\/cocktails\/link-swizzle\?recipe=added$/);
  await expect(page.getByRole("link", { name: /127\.0\.0\.1/ })).toHaveAttribute("href", `${MOCK_URL}/__mock/recipe-page`);
});

test("photo: resized in the browser, read, with warnings; duplicate names are caught", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/new");
  await page.getByLabel(/Photo of the recipe/).setInputFiles({ name: "card.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "The photo you chose" })).toBeVisible();
  await page.getByRole("button", { name: "Read the recipe" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Photo Punch");
  await expect(page.getByText("The garnish was hard to read.")).toBeVisible();
  await expect(page.getByLabel(/Where it's from/)).toHaveValue("Test book, p. 12");

  // A name that's taken: a clear error, and nothing typed is lost.
  await page.getByLabel("Name").fill("Test Swizzle");
  await page.getByRole("group", { name: "Ingredient 2" }).getByLabel("Amount").fill("1 1/4");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByLabel("Name")).toBeFocused();
  await expect(page.locator("#name-error")).toHaveText(/There's already a drink called “Test Swizzle”/);
  await expect(page.getByRole("group", { name: "Ingredient 2" }).getByLabel("Amount")).toHaveValue("1 1/4");

  // Empty name and an empty ingredient row.
  await page.getByLabel("Name").fill("");
  await page.getByRole("button", { name: "+ Add an ingredient" }).click();
  await expect(page.getByRole("group", { name: "Ingredient 5" }).getByLabel("Amount")).toBeFocused();
  await page.getByRole("group", { name: "Ingredient 5" }).getByLabel("Amount").fill("1");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.locator("#name-error")).toHaveText("Give the drink a name.");
  await expect(page.getByText("Say what the ingredient is.")).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel("Name").fill("Photo Punch");
  await page.getByRole("button", { name: "Remove ingredient 5" }).click();
  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page).toHaveURL(/\/cocktails\/photo-punch\?recipe=added$/);
  await expect(page.getByText(/from Test book, p\. 12/)).toBeVisible();
});

test("edit and delete our recipe; Difford's recipes can't be edited", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/test-swizzle");
  await page.getByRole("link", { name: "Edit or delete this recipe" }).click();
  await expect(page).toHaveURL(/\/cocktails\/test-swizzle\/edit$/);
  await expect(page.getByRole("heading", { level: 1, name: "Edit Test Swizzle" })).toBeVisible();
  await expect(page.getByLabel("Garnish")).toHaveValue("Mint sprig and a paper umbrella");
  await expectAccessible(page);

  await page.getByLabel("Glass").fill("Coupe");
  await page.getByRole("button", { name: "Remove ingredient 4" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/cocktails\/test-swizzle\?recipe=saved$/);
  await expect(page.getByRole("status")).toHaveText("Recipe saved.");
  await expect(page.getByText("Coupe")).toBeVisible();
  await expect(page.getByText("House tincture")).toHaveCount(0);

  // Genny can edit it, but only John (who added it) can delete it.
  const ctx = await page.context().browser()!.newContext();
  const genny = await ctx.newPage();
  await signIn(genny, GENNY, "/cocktails/test-swizzle/edit");
  await expect(genny.getByText("Only JB can delete this recipe.")).toBeVisible();
  await expect(genny.getByRole("button", { name: "Delete recipe" })).toHaveCount(0);
  await ctx.close();

  // Delete (needs the confirmation tick).
  await page.goto("/cocktails/test-swizzle/edit");
  await page.getByText("Delete this recipe").click();
  await page.getByRole("checkbox", { name: /Yes, delete Test Swizzle/ }).check();
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await expect(page).toHaveURL(/\/\?recipe=deleted$/);
  await expect(page.getByRole("status").filter({ hasText: "The recipe was deleted." })).toBeVisible();
  await page.goto("/?q=test%20swizzle");
  await expect(page.getByText("No drinks match “test swizzle”.")).toBeVisible();

  // The verified Top 100 stay read-only.
  await page.goto("/cocktails/zombie");
  await expect(page.getByRole("link", { name: "Edit or delete this recipe" })).toHaveCount(0);
  await page.goto("/cocktails/zombie/edit");
  await expect(page.getByText(/couldn.t find|not found/i).first()).toBeVisible();
});
