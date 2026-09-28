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

test("bottle levels, 'We made this' counting down (and undo), and running-low alerts", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates the shared cabinet");
  const row = (name: string) =>
    page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(`^${name}`) }) });

  await signIn(page, JOHN, "/cabinet/edit");
  for (const [family, box] of [
    ["Rum", /^Navy rum/],
    ["Juices & purées", /^Pineapple juice/],
    ["Other", /^Cream of coconut/],
  ] as const) {
    await openFamily(page, family);
    await page.getByRole("checkbox", { name: box }).check();
  }
  await page.getByRole("button", { name: "Save our bar" }).click();
  await expect(page).toHaveURL(/\/cabinet\?saved=1$/);

  await page.getByRole("link", { name: /Bottle levels/ }).click();
  await expect(page).toHaveURL(/\/cabinet\/levels$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bottle levels" })).toBeVisible();

  await row("Navy rum").getByLabel("Bottle size").selectOption("700");
  await row("Navy rum").getByRole("button", { name: "½ full" }).click();
  await expect(page).toHaveURL(/\/cabinet\/levels\?levels=saved&id=navy-rum#level-navy-rum$/);
  await expect(row("Navy rum").getByRole("status")).toHaveText("Saved Navy rum.");
  await expect(row("Navy rum").getByRole("status")).toBeFocused();
  await expect(row("Navy rum")).toContainText("about 350 ml (11 3/4 fl oz) left");

  await row("Pineapple juice").getByLabel("Bottle size").selectOption("1000");
  await row("Pineapple juice").getByRole("button", { name: "Full", exact: true }).click();
  await expect(row("Pineapple juice")).toContainText("about 1000 ml");
  await expect(row("Cream of coconut")).toContainText("Not tracked");
  await expect(page).toHaveTitle(/Adventures in Tiki/);
  const levelsScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(levelsScan.violations).toEqual([]);

  // Renaming a bottle on the edit page keeps its level.
  await page.goto("/cabinet/edit");
  await page.locator("#bottle-navy-rum").fill("Pusser's Gunpowder Proof");
  await page.getByRole("button", { name: "Save our bar" }).click();
  await page.goto("/cabinet/levels");
  await expect(row("Navy rum")).toContainText("about 350 ml");

  // Make two Painkillers.
  await page.goto("/cocktails/painkiller?serves=2");
  const making = page.getByRole("region", { name: "Making it" });
  await expect(making).toContainText("Counts down our bar: Navy rum 90 ml, Pineapple juice 180 ml.");
  await expect(making).toContainText("Not tracked: Cream of coconut.");
  // A double submit (same form, twice) records once.
  await making.locator("form").filter({ has: page.getByRole("button", { name: "We made this (2 drinks)" }) }).evaluate((f: HTMLFormElement) => {
    f.requestSubmit();
    f.requestSubmit();
  });
  await expect(page).toHaveURL(/\/cocktails\/painkiller\?serves=2&made=[0-9a-f-]{36}#made$/);
  const done = page.getByRole("status").filter({ hasText: "Cheers! Recorded 2 drinks." });
  await expect(done).toBeFocused();
  await expect(done).toContainText("Navy rum: −90 ml, about 260 ml (8 3/4 fl oz) left");
  await expect(done).toContainText("Pineapple juice: −180 ml, about 820 ml");
  await expect(making.getByRole("button", { name: "Made another round (2 drinks)" })).toBeVisible();
  await expect(page).toHaveTitle(/Adventures in Tiki/);
  const cardScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(cardScan.violations).toEqual([]);

  // Undo puts back exactly what was taken, keeps the servings, and a second undo says so.
  const undoUrl = page.url();
  await making.getByRole("button", { name: "Undo" }).click();
  await expect(page).toHaveURL(/\/cocktails\/painkiller\?serves=2&made=undone#made$/);
  await expect(page.getByRole("status").filter({ hasText: "Undone" })).toBeVisible();
  await page.goto(undoUrl);
  await expect(page.getByRole("status").filter({ hasText: "Cheers" })).toHaveCount(0); // that pour is gone
  await page.goto("/cabinet/levels");
  await expect(row("Navy rum")).toContainText("about 350 ml");

  // Nearly empty -> running low on our bar and the home page, then restock via the shopping list.
  await row("Navy rum").getByRole("button", { name: "Nearly empty" }).click();
  await expect(row("Navy rum")).toContainText("Running low");
  await page.goto("/cabinet");
  const low = page.getByRole("region", { name: /Running low/ });
  await expect(low.getByRole("link", { name: "Navy rum" })).toBeVisible();
  await expect(low).toContainText("about 70 ml");
  await low.getByRole("button", { name: "Add to shopping list: Navy rum" }).click();
  await expect(page.getByRole("link", { name: /Shopping list \(1\)/ })).toBeVisible();
  await page.goto("/");
  await expect(page.getByText(/Running low:\s*Navy rum/)).toBeVisible();

  await page.goto("/shopping");
  const item = page.getByRole("list", { name: "To buy" }).getByRole("listitem").filter({ hasText: "Navy rum" }).first();
  await expect(item).toContainText("Restock — we're running low (about 70 ml");
  await page.getByRole("button", { name: "Got it — add to our bar: Navy rum" }).click();
  await expect(page).toHaveURL(/shopping=bought/);
  await page.goto("/cabinet/levels");
  await expect(row("Navy rum")).toContainText("about 700 ml");
  await expect(row("Navy rum")).not.toContainText("Running low");
});

// A 2x2 PNG, enough for the browser to decode and resize.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64"
);

test("scan a bottle (style, size, level) and a receipt into our bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "mutates the shared cabinet");
  const scan = async (kind: "A bottle" | "A receipt") => {
    await page.goto("/cabinet");
    await page.getByRole("link", { name: /Scan a bottle or receipt/ }).click();
    await expect(page).toHaveURL(/\/cabinet\/scan$/);
    await page.getByText(kind, { exact: true }).click();
    await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("img", { name: "The photo you chose" })).toBeVisible();
    await page.getByRole("button", { name: "Read the photo" }).click();
  };
  const axe = async () => {
    await expect(page).toHaveTitle(/Adventures in Tiki/);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations).toEqual([]);
  };
  const row = (name: string) =>
    page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(`^${name}`) }) });

  await signIn(page, JOHN, "/cabinet");
  await axe();

  // A bottle.
  await scan("A bottle");
  await expect(page.getByRole("heading", { name: "Check the bottle, then save" })).toBeFocused();
  await expect(page.getByLabel("Bottle", { exact: true })).toHaveValue("Pusser's Gunpowder Proof");
  await expect(page.getByLabel("Style in our catalog")).toHaveValue("navy-rum");
  await expect(page.getByLabel("Bottle size")).toHaveValue("700");
  await expect(page.getByLabel(/How full/)).toHaveValue("60");
  await expect(page.getByText("Dark glass, so the level is a rough guess.")).toBeVisible();
  await axe();
  await page.getByRole("button", { name: "Save to our bar" }).click();
  await expect(page).toHaveURL(/\/cabinet\/levels\?levels=saved&id=navy-rum#level-navy-rum$/);
  await expect(row("Navy rum")).toContainText("Pusser's Gunpowder Proof");
  await expect(row("Navy rum")).toContainText("about 420 ml");

  // A receipt.
  await scan("A receipt");
  await expect(page.getByRole("heading", { name: "Check the receipt, then add" })).toBeFocused();
  const add = (label: RegExp) => page.getByRole("checkbox", { name: label });
  await expect(add(/Pusser's/)).toBeChecked();
  await expect(add(/Falernum/)).toBeChecked();
  await expect(add(/Coco López/)).toBeChecked();
  await expect(add(/Limes/)).not.toBeChecked(); // a staple, not a bar bottle
  await expect(add(/Bag fee/)).not.toBeChecked();
  // It says what a save would replace.
  await expect(page.getByText(/Replaces what's in our bar for this style: Pusser's Gunpowder Proof \(about 420 ml/)).toBeVisible();
  await expect(page.getByText("Bought 2: we track one bottle per style, so the others aren't counted.")).toBeVisible();
  await axe();
  // Coco López has no size on the receipt: it must be fixed or unticked.
  await page.getByRole("button", { name: "Add ticked items to our bar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Each ticked item needs what it is and its size." })).toBeFocused();
  await expect(page.getByText("Pick a size, or untick it.")).toBeVisible();
  await expect(page.getByLabel("Size").nth(2)).toHaveAttribute("aria-invalid", "true");
  await add(/Coco López/).uncheck();
  await page.getByRole("button", { name: "Add ticked items to our bar" }).click();
  await expect(page).toHaveURL(/\/cabinet\?scanned=2$/);
  await expect(page.getByRole("status").filter({ hasText: "Added 2 bottles from the receipt." })).toBeVisible();
  await page.goto("/cabinet/levels");
  await expect(row("Navy rum")).toContainText("about 700 ml"); // a new, full bottle
  await expect(row("Falernum liqueur")).toContainText("about 750 ml");
});
