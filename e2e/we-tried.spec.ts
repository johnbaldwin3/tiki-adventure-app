import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { GENNY, JOHN, MOCK_URL, signIn } from "./auth";

// Changes tastings, so it runs in the serial "recipes" project and puts them back afterwards.
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-tastings`);
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-tastings`);
});

const tasting = (page: Page) => page.getByRole("region", { name: "Our tasting" });
const card = (page: Page, who: string) => tasting(page).getByRole("listitem").filter({ hasText: who });

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

test("we tried it together: the other taster is asked for their rating, and either can enter the other's", async ({ page, browser }) => {
  await signIn(page, JOHN, "/cocktails/daiquiri");
  await expect(card(page, "Genny")).toContainText("Not tasted yet");

  // John saves his own rating and ticks "Genny tried it too".
  await card(page, "John").getByRole("link", { name: "Add rating & notes for John" }).click();
  await page.getByRole("checkbox", { name: /I've tried this/ }).check();
  await page.getByLabel("Rating").fill("8");
  await page.getByLabel("Date tasted").fill("2026-11-20");
  await page.getByRole("checkbox", { name: /Genny tried it too/ }).check();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/cocktails\/daiquiri#tasting$/);
  await expect(card(page, "Genny")).toContainText("Tried — not rated yet");
  await expect(card(page, "Genny")).toContainText("Tasted Nov 20, 2026");
  await expect(card(page, "Genny")).toContainText("Entered by JB");

  // Genny, next time she opens the app, is asked for her rating.
  const ctx = await browser.newContext();
  const genny = await ctx.newPage();
  await signIn(genny, GENNY, "/");
  // (She has other tried-but-unrated drinks in the seed data too.)
  const prompt = genny.getByRole("region", { name: /you've tried needs? your rating/ });
  await expect(prompt.getByRole("heading")).toHaveText(/^\d+ drinks? you've tried needs? your rating$/);
  const more = prompt.getByText(/^Show \d+ more$/);
  if (await more.count()) await more.click();
  await prompt.getByRole("link", { name: /^Daiquiri\s*: add your rating$/ }).click();
  await expect(genny).toHaveURL(/\/cocktails\/daiquiri\/tasting\/gm$/);
  await expect(genny.getByRole("checkbox", { name: /I've tried this/ })).toBeChecked();
  await genny.getByLabel("Rating").fill("7");
  await genny.getByRole("button", { name: "Save" }).click();
  await expect(card(genny, "Genny")).toContainText("7");
  await expect(card(genny, "Genny")).not.toContainText("Entered by");
  await genny.goto("/");
  await expect(genny.getByRole("link", { name: /^Daiquiri\s*: add your rating$/ })).toHaveCount(0);
  await ctx.close();

  // John can also enter (or fix) Genny's rating; her card says he did.
  await page.reload();
  await card(page, "Genny").getByRole("link", { name: "Edit Genny's" }).click();
  await expect(page).toHaveURL(/\/cocktails\/daiquiri\/tasting\/gm$/);
  await expect(page.getByText("You're entering Genny's rating & notes.")).toBeVisible();
  await expect(page.getByLabel("Rating")).toHaveValue("7");
  await page.getByLabel("Rating").fill("7.5");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(card(page, "Genny")).toContainText("7.5");
  await expect(card(page, "Genny")).toContainText("Entered by JB");
  await expectAccessible(page);
});
