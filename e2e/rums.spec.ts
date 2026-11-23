import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { JOHN, MOCK_URL, signIn } from "./auth";

// Labels rums in the shared bar, so it runs in the serial "recipes" project and resets around itself.
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-shared`);
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-shared`);
});

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64"
);

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

test("the rum guide: 8 numbers, 21 categories, and look up a bottle in the book's list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Rum numbers/ }).click();
  await expect(page).toHaveURL(/\/rums$/);
  await expect(page.getByRole("heading", { level: 1, name: "Rum numbers" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "The numbers" }).getByRole("link")).toHaveCount(8);
  await expect(page.getByRole("article")).toHaveCount(21);
  await expect(page.getByRole("heading", { level: 3, name: "Number 1: Pot still lightly aged" })).toBeVisible();
  await expect(page.locator("#pot-still-lightly-aged")).toContainText("Smith & Cross (overproof)");
  await expect(page.getByRole("main")).toContainText("Martin & Rebecca Cate (2016), pp. 197–199");
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel("Bottle, brand or category").fill("coruba");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page).toHaveURL(/\/rums\?q=coruba$/);
  const hits = page.getByRole("list", { name: "Matching bottles" });
  await expect(hits.getByRole("listitem")).toHaveCount(1);
  await expect(hits.getByRole("link", { name: "Smuggler's Cove rum number 5, Black blended" })).toBeVisible();

  await page.goto("/rums?q=crossfire hurricane");
  await expect(page.getByRole("main").getByRole("status")).toContainText("isn't in the book's list");
});

test("recipe cards and ingredient pages show the number for rums", async ({ page }) => {
  await page.goto("/ingredients/rhum-agricole-vieux");
  const section = page.getByRole("region", { name: "Smuggler's Cove rum number" });
  await expect(section.getByRole("link", { name: "Smuggler's Cove rum number 8, Cane AOC Martinique rhum agricole vieux" })).toBeVisible();
  // Brands the book lists get their number.
  await expect(page.getByRole("region", { name: "Bottles to look for" }).getByRole("link", { name: /rum number 8/ })).toHaveCount(3);

  await page.goto("/ingredients/aged-jamaican-rum");
  await expect(page.getByRole("link", { name: "Smuggler's Cove rum number 3, Blended aged (our closest match)" }).first()).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Our closest match, not from the book.");

  // Not every ingredient is a rum.
  await page.goto("/ingredients/lime");
  await expect(page.getByRole("region", { name: "Smuggler's Cove rum number" })).toHaveCount(0);

  await page.goto("/cocktails/painkiller");
  await expect(page.getByRole("region", { name: "Ingredients" }).getByRole("link", { name: /^Smuggler's Cove rum/ }).first()).toBeVisible();
});

test("check a bottle by name or photo, and label our bar's rum with its number", async ({ page }) => {
  await signIn(page, JOHN, "/cabinet/edit");
  // Two rums in our bar: one the book lists, one without a bottle name.
  for (const [style, bottle] of [
    ["navy-rum", "Pusser's Gunpowder Proof"],
    ["dark-rum", ""],
  ]) {
    const family = page.locator("details").filter({ has: page.locator("summary", { hasText: "Rum ·" }) });
    if ((await family.getAttribute("open")) === null) await family.locator("summary").click();
    await page.locator(`#have-${style}`).check();
    if (bottle) await page.locator(`#bottle-${style}`).fill(bottle);
  }
  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page).toHaveURL(/\/cabinet\?saved=1$/);
  // On the shelf: Pusser's from the book (3); the unnamed dark rum by its style (≈5).
  await expect(page.getByRole("link", { name: "Smuggler's Cove rum number 3, Blended aged" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Smuggler's Cove rum number 5, Black blended (our closest match)" })).toBeVisible();

  await page.getByRole("link", { name: /Rum numbers/ }).click();
  const checker = page.getByRole("region", { name: "What number is this bottle?" });

  // A name the book lists: answered from the book, no AI.
  await checker.getByLabel("…or the bottle's name").fill("Coruba");
  await checker.getByRole("button", { name: "What number is it?" }).click();
  await expect(checker.getByText("Number 5: Black blended")).toBeVisible();
  await expect(checker).toContainText("In the book's rum list (p. 198): Coruba.");
  await expectAccessible(page);

  // A photo of a label the book doesn't list: the checker's best guess, marked as such.
  await checker.getByLabel(/Photo of the label/).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG });
  await expect(checker.getByRole("img", { name: "The label photo you chose" })).toBeVisible();
  await checker.getByLabel("…or the bottle's name").fill("");
  await checker.getByRole("button", { name: "What number is it?" }).click();
  await expect(checker.getByRole("heading", { name: "Mystery Estate 6 Year" })).toBeVisible();
  await expect(checker.getByText("Number 3: Blended aged")).toBeVisible();
  await expect(checker).toContainText("best guess using the book's rules (medium confidence)");
  await expectAccessible(page);

  // Label our dark rum with it (and name the bottle).
  await checker.getByLabel("Bought it? Label our bottle").selectOption("dark-rum");
  await checker.getByRole("button", { name: "Save the number" }).click();
  await expect(page).toHaveURL(/\/rums\?labeled=saved#our-rums$/);
  const ours = page.getByRole("region", { name: "Our rums" });
  const dark = ours.getByRole("listitem").filter({ hasText: "Mystery Estate 6 Year" });
  // An AI guess stays marked as approximate.
  await expect(dark.getByRole("link", { name: "Smuggler's Cove rum number 3, Blended aged (our closest match)" })).toBeVisible();
  await expect(dark).toContainText("Number from: our label, from the rum checker's best guess.");
  await expectAccessible(page);

  // When the photo shows a bottle the book lists, the book wins over the AI.
  await checker.getByLabel(/Photo of the label/).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG });
  await checker.getByLabel("…or the bottle's name").fill("SMITH LABEL");
  await checker.getByRole("button", { name: "What number is it?" }).click();
  await expect(checker.getByText("Number 1: Pot still lightly aged")).toBeVisible();
  await expect(checker).toContainText("In the book's rum list (p. 197): Smith & Cross (overproof).");

  // Clear our label: back to the style's closest number.
  await dark.getByText("Change its label").click();
  await dark.getByRole("combobox", { name: "Category" }).selectOption("");
  await dark.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Label cleared" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Our rums" }).getByRole("listitem").filter({ hasText: "Mystery Estate 6 Year" })
  ).toContainText("Number from: its style");
});
