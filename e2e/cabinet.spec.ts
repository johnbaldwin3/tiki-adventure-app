import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { GENNY, JOHN, MOCK_URL, signIn } from "./auth";
import type { Page } from "@playwright/test";

/** Expand a family's <details> (families you own start open). */
async function openFamily(page: Page, family: string) {
  const details = page.locator("details").filter({ has: page.locator("summary", { hasText: `${family} ·` }) });
  if ((await details.getAttribute("open")) === null) await details.locator("summary").click();
}

// Both tests that change shared state run in order, in one worker.
test.describe.configure({ mode: "serial" });

// Start (and restart, on retry) from an empty bar and shopping list. Only in
// the project that mutates them, so it never resets mid-test under another.
test.beforeEach(async ({ request }, testInfo) => {
  if (testInfo.project.name !== "chromium") return;
  const res = await request.post(`${MOCK_URL}/__mock/reset-shared`);
  expect(res.ok()).toBe(true);
});

// The cabinet is one shared bar for the whole app, and the mock keeps writes
// in memory while projects run in parallel. So the test that changes it runs
// in the desktop project only; the mobile project checks read-only views.

test("signed out, our bar asks you to sign in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Our bar/ }).click();
  await expect(page).toHaveURL(/\/cabinet$/);
  await expect(page.getByRole("heading", { level: 1, name: "Our bar" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?next=%2Fcabinet"
  );
  await expect(page.getByRole("link", { name: /^(Edit our bar|Add what we have)$/ })).toHaveCount(0);
});

test("the edit page needs a signed-in taster", async ({ page }) => {
  await page.goto("/cabinet/edit");
  await expect(page).toHaveURL(/\/login\?next=%2Fcabinet%2Fedit$/);
});

test("stock the bar, see what we can make, and share it between tasters", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates the shared cabinet");

  await signIn(page, JOHN, "/cabinet");
  await page.getByRole("link", { name: /^(Edit our bar|Add what we have)$/ }).click();
  await expect(page).toHaveURL(/\/cabinet\/edit$/);
  await expect(page).toHaveTitle(/Edit our bar/);

  // Staples aren't offered; they're assumed on hand.
  await expect(page.getByRole("checkbox", { name: /Lime \/ lime juice/ })).toHaveCount(0);

  // Bottle field appears only once the box is ticked (CSS :has, no JS).
  await openFamily(page, "Rum");
  const navy = page.getByRole("checkbox", { name: /^Navy rum/ });
  const navyBottle = page.locator("#bottle-navy-rum");
  await expect(navyBottle).toBeHidden();
  await navy.check();
  await expect(navyBottle).toBeVisible();
  await navyBottle.fill("  Pusser's   Gunpowder Proof ");

  await openFamily(page, "Juices & purées");
  await page.getByRole("checkbox", { name: /^Pineapple juice/ }).check();
  await openFamily(page, "Other");
  await page.getByRole("checkbox", { name: /^Cream of coconut/ }).check();

  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page).toHaveURL(/\/cabinet\?saved=1$/);
  await expect(page.getByRole("status")).toContainText("Our bar is saved.");
  await expect(page.getByText("3 ingredients on the shelf · 1 drink ready to make")).toBeVisible();

  const ready = page.getByRole("list", { name: "Ready to make" });
  await expect(ready.getByRole("link", { name: /Painkiller/ })).toBeVisible();

  const shelf = page.getByRole("region", { name: "On the shelf" });
  await expect(shelf.getByText("Pusser's Gunpowder Proof", { exact: true })).toBeVisible();

  // The recipe card knows too.
  await ready.getByRole("link", { name: /Painkiller/ }).click();
  await expect(page).toHaveURL(/\/cocktails\/painkiller$/);
  await expect(page.getByText(/We can make this with what's in our bar/)).toBeVisible();

  await page.goto("/cocktails/zombie");
  await expect(page.getByText(/Missing from our bar:/)).toBeVisible();

  // And the ingredient page.
  await page.goto("/ingredients/navy-rum");
  await expect(page.getByText(/In our bar: Pusser's Gunpowder Proof/)).toBeVisible();

  // John opens the edit page and leaves it open (stale) while Genny edits.
  await page.goto("/cabinet/edit");

  // Genny sees the same shared bar.
  const ctx = await browser.newContext();
  const genny = await ctx.newPage();
  await signIn(genny, GENNY, "/cabinet");
  await expect(genny.getByRole("list", { name: "Ready to make" }).getByRole("link", { name: /Painkiller/ })).toBeVisible();

  // She unticks the pineapple juice; Painkiller drops off and it becomes a "buy next".
  await genny.getByRole("link", { name: "Edit our bar", exact: true }).click();
  await genny.getByRole("checkbox", { name: /^Pineapple juice/ }).uncheck();
  // The bottle she didn't touch is kept.
  await expect(genny.locator("#bottle-navy-rum")).toHaveValue("Pusser's Gunpowder Proof");
  await genny.getByRole("button", { name: "Save our bar" }).click();
  await expect(genny).toHaveURL(/\/cabinet\?saved=1$/);
  await expect(genny.getByText(/2 ingredients on the shelf/)).toBeVisible();
  await expect(genny.getByRole("list", { name: "Ready to make" })).toHaveCount(0);
  await expect(
    genny.getByRole("region", { name: "Buy next" }).getByRole("link", { name: "Pineapple juice", exact: true })
  ).toBeVisible();
  await ctx.close();

  // John's stale form only saves what he changed: adding orgeat doesn't
  // bring back the pineapple juice Genny just removed.
  await openFamily(page, "Syrups");
  await page.getByRole("checkbox", { name: /^Orgeat \(almond\) syrup/ }).check();
  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page).toHaveURL(/\/cabinet\?saved=1$/);
  await expect(page.getByText(/^3 ingredients on the shelf/)).toBeVisible();
  const shelfNow = page.getByRole("region", { name: "On the shelf" });
  await expect(shelfNow.getByRole("link", { name: "Orgeat (almond) syrup" })).toBeVisible();
  await expect(shelfNow.getByRole("link", { name: "Pineapple juice" })).toHaveCount(0);

  // Axe on both signed-in pages.
  for (const path of ["/cabinet", "/cabinet/edit"]) {
    await page.goto(path);
    await expect(page).toHaveTitle(/Adventures in Tiki/);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations, path).toEqual([]);
  }

  // Clean up so reruns start empty.
  await page.goto("/cabinet/edit");
  const owned = await page.locator('input[name="have"]:checked').evaluateAll((els) =>
    els.map((el) => (el as HTMLInputElement).value)
  );
  for (const id of owned) await page.locator(`#have-${id}`).uncheck();
  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page.getByText(/0 ingredients on the shelf/)).toBeVisible();
});

test("shopping list: add missing, see what it unlocks, got it, remove", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates the shared shopping list and cabinet");

  await signIn(page, JOHN, "/shopping");
  await expect(page.getByRole("heading", { level: 1, name: "Shopping list" })).toBeVisible();
  await expect(page.getByText(/The list is empty/)).toBeVisible();

  // From a recipe card: add everything it's missing.
  await page.goto("/cocktails/painkiller");
  await expect(page.getByText(/Missing from our bar:/)).toBeVisible();
  await page.getByRole("button", { name: "Add all 3 to shopping list" }).click();
  await expect(page).toHaveURL(/\/cocktails\/painkiller\?shopping=added$/);
  await expect(page.getByRole("status")).toContainText("Added to the shopping list.");
  await expect(page.getByRole("link", { name: /On the shopping list/ })).toBeVisible();

  await page.getByRole("link", { name: /On the shopping list/ }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(page.getByText(/^3 to buy · would let us make \d+ more drinks?$/)).toBeVisible();
  const list = page.getByRole("list", { name: "To buy" });
  await expect(list.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Navy rum", exact: true }) })).toContainText(
    /With the rest of the list, completes:.*Painkiller/
  );
  await expect(page.getByRole("link", { name: /Search Total Wine for Pusser's/ }).first()).toHaveAttribute(
    "href",
    /totalwine\.com\/search\/all\?text=Pusser/
  );
  await expect(page.getByRole("link", { name: "(864) 283-6049" })).toHaveAttribute("href", "tel:+18642836049");

  // Genny sees the same list.
  const ctx = await browser.newContext();
  const genny = await ctx.newPage();
  await signIn(genny, GENNY, "/shopping");
  await expect(genny.getByText(/^3 to buy/)).toBeVisible();
  await ctx.close();

  // Got it: onto the shelf, off the list.
  await page.getByRole("button", { name: "Got it — add to our bar: Navy rum" }).click();
  await expect(page).toHaveURL(/\/shopping\?shopping=bought$/);
  await expect(page.getByRole("status")).toContainText("Moved to our bar.");
  await expect(page.getByText(/^2 to buy/)).toBeVisible();
  await page.goto("/cabinet");
  await expect(page.getByRole("region", { name: "On the shelf" }).getByRole("link", { name: "Navy rum" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Shopping list \(2\)/ })).toBeVisible();

  // Remove one.
  await page.goto("/shopping");
  await page.getByRole("button", { name: "Remove: Cream of coconut" }).click();
  await expect(page.getByRole("status")).toBeFocused();
  await expect(page.getByText(/^1 to buy/)).toBeVisible();

  // A recipe card offers only what isn't on the list yet.
  await page.goto("/cocktails/painkiller");
  await expect(page.getByRole("button", { name: "Add Cream of coconut to shopping list" })).toBeVisible();

  // From an ingredient page: add, then remove.
  await page.goto("/ingredients/falernum");
  await page.getByRole("button", { name: "Add to shopping list", exact: true }).click();
  await expect(page).toHaveURL(/\/ingredients\/falernum\?shopping=added$/);
  await expect(page.getByRole("link", { name: /On the shopping list/ })).toBeVisible();
  await page.goto("/shopping");
  await expect(page.getByText(/^2 to buy/)).toBeVisible();

  await expect(page).toHaveTitle(/Adventures in Tiki/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);

  // An ingredient we already have offers no add button.
  await page.goto("/ingredients/navy-rum");
  await expect(page.getByText(/In our bar/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Add to shopping list/ })).toHaveCount(0);

  // Clean up so reruns start empty.
  await page.goto("/shopping");
  for (const name of ["Pineapple juice", "Falernum liqueur"]) {
    await page.getByRole("button", { name: `Remove: ${name}` }).click();
    await expect(page).toHaveURL(/shopping=removed/);
  }
  await expect(page.getByText(/The list is empty/)).toBeVisible();
  await page.goto("/cabinet/edit");
  await page.locator("#have-navy-rum").uncheck();
  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page.getByText(/^0 ingredients on the shelf/)).toBeVisible();
});

test("signed out, the shopping list asks you to sign in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Shopping list/ }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fshopping");
  // No shopping controls on public pages.
  await page.goto("/ingredients/falernum");
  await expect(page.getByRole("button", { name: /shopping list/ })).toHaveCount(0);
});
