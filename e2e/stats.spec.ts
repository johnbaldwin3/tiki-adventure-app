import { test, expect } from "@playwright/test";

// Fixtures: seed-data/cocktails.json via e2e/mock-supabase.mjs. The tasting
// e2e test edits Nui Nui / Hawaiian Eye in parallel, so assertions here stick
// to numbers those edits can't change (tried counts, top 5), or cross-check
// numbers against each other on the same page (table totals vs tiles).

test("home links to the stats dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /See all our stats/ }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page).toHaveTitle(/Our stats/);
  await expect(page.getByRole("heading", { level: 1, name: "Our stats" })).toBeVisible();
});

test("stats dashboard shows progress, tasters, spread, disagreements and top 5", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByText("of 100 tasted")).toBeVisible();

  const meters = page.getByRole("meter");
  await expect(meters).toHaveCount(5);
  await expect(page.getByRole("meter", { name: "Tasted, all 100" })).toHaveAttribute("aria-valuenow", "21");
  // The four Difford's bands add up to the total.
  const bandValues = await Promise.all(
    ["1–25", "26–50", "51–75", "76–100"].map((b) =>
      page.getByRole("meter", { name: `Tasted, Difford's ${b}` }).getAttribute("aria-valuenow")
    )
  );
  expect(bandValues.reduce((n, v) => n + Number(v), 0)).toBe(21);

  for (const heading of ["Progress through the list", "John vs Genny", "Rating spread", "Where we disagree"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // Rating spread table view: one row per bin, counts are numbers.
  await page.getByText("Show as table").click();
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(6); // header + 5 bins
  // Each column of the table adds up to that taster's "N rated" tile.
  const cells = await page.getByRole("table").locator("tbody tr").evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => Number(td.textContent)))
  );
  const [jbTotal, gmTotal] = [0, 1].map((c) => cells.reduce((n, row) => n + row[c], 0));
  const ratedCounts = await page.getByText(/^\d+ rated/).allTextContents();
  expect(ratedCounts.map((t) => parseInt(t, 10))).toEqual([jbTotal, gmTotal]);

  // Disagreement rows link to recipe cards.
  const disagree = page.getByRole("list", { name: "Cocktails we disagree on" }).getByRole("listitem");
  expect(await disagree.count()).toBeGreaterThan(0);
  await expect(disagree.first()).toContainText(/JB \d.* · GM \d.* · gap \d/);
  await expect(disagree.first().getByRole("link")).toHaveAttribute("href", /^\/cocktails\//);

  const top = page.getByRole("region", { name: "Our favorites" }).getByRole("listitem");
  await expect(top.first()).toContainText("Tiki Max");
  await expect(top.first()).toContainText("9.41");
  await top.first().getByRole("link").click();
  await expect(page).toHaveURL(/\/cocktails\/tiki-max$/);
});

test("stats page fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/stats");
  await expect(page.getByRole("heading", { level: 1, name: "Our stats" })).toBeVisible();
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});

test("an unknown page shows the site-wide not-found page", async ({ page }) => {
  const res = await page.goto("/this-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
