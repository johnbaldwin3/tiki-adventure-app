import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/Equal Parts/);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
}

test("search the list by name, words in any order, ignoring punctuation", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search by name, spirit or ingredient" });
  await search.fill("mai tai");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/\?q=mai\+tai$/);
  await expect(search).toBeFocused(); // the box stays put while results change

  const list = page.getByRole("list", { name: "Cocktails" });
  await expect(page.getByRole("status").filter({ hasText: "drinks match “mai tai”" })).toBeVisible();
  for (const name of ["Mai Tai (Difford's recipe)", "Mai Tai (Trader Vic's)", "Mai Dutch Tai", "Totally Tropical Mai Tai"]) {
    await expect(list.getByRole("link", { name: new RegExp(name.replace(/[()]/g, "\\$&")) })).toBeVisible();
  }
  await expect(list.getByRole("listitem")).toHaveCount(4);
  await expect(search).toHaveValue("mai tai");

  // Filters keep the search.
  await page.getByRole("navigation", { name: "Filter cocktails" }).getByRole("link", { name: /^Not yet/ }).click();
  await expect(page).toHaveURL(/\?q=mai\+tai&show=untasted$/);

  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/\?show=untasted$/);
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();

  // Searching from a filtered view gives the same URL the links build.
  await search.fill("  zombie  ");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/\?q=zombie&show=untasted$/);
});

test("search finds ingredients and spirits, and says when nothing matches", async ({ page }) => {
  await page.goto("/?q=humuhumu");
  await expect(page.getByRole("list", { name: "Cocktails" }).getByRole("listitem")).toHaveCount(1);

  await page.goto("/?q=jamaican%20falernum");
  const list = page.getByRole("list", { name: "Cocktails" });
  await expect(list.getByRole("link", { name: /Zombie/ }).first()).toBeVisible();
  await expectAccessible(page);

  await page.goto("/?q=zzzz");
  await expect(page.getByText("No drinks match “zzzz”.")).toBeVisible();

  // An empty search is dropped from the URL.
  await page.goto("/?q=%20%20&show=tasted");
  await expect(page).toHaveURL(/\/\?show=tasted$/);
});

test("try next: three picks on the home page, ten with reasons on /next", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Try next" });
  await expect(section.getByRole("listitem")).toHaveCount(3);

  await section.getByRole("link", { name: /More ideas to try/ }).click();
  await expect(page).toHaveURL(/\/next$/);
  await expect(page).toHaveTitle(/What to try next/);
  await expect(page.getByRole("heading", { level: 1, name: "What to try next" })).toBeVisible();
  const picks = page.getByRole("list", { name: "Suggestions" }).getByRole("listitem");
  await expect(picks).toHaveCount(10);
  // Each pick says why (a "Like …" match, or its Difford's rank).
  for (const pick of await picks.all()) await expect(pick).toContainText(/Like .+ \(our [\d.]+\): both use|on Difford's list/);
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fnext");

  // Suggestions are never drinks we've tried: the first one's card has no ratings yet.
  await picks.first().getByRole("link").click(); // the drink's name
  await expect(page).toHaveURL(/\/cocktails\//);
  await expect(page.getByRole("region", { name: "Our tasting" })).not.toContainText(/\d+(\.\d+)? \/ 10/);

  await page.goto("/next");
  await page.getByText("How this works").click();
  await expectAccessible(page);
});
