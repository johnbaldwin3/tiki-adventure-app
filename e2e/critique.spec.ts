import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { JOHN, MOCK_URL, signIn } from "./auth";

// Saves versions of the Negroni, so it runs in the serial "recipes" project and resets around itself.
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-collections`);
});
test.afterAll(async ({ request }) => {
  await request.post(`${MOCK_URL}/__mock/reset-collections`);
});

const main = (page: Page) => page.getByRole("main");
const ingredients = (page: Page) => page.getByRole("region", { name: "Ingredients" });

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" | ")}`)).toEqual([]);
}

async function critique(page: Page, chip: string | null, note = "") {
  const section = page.locator("#critique");
  await section.getByText("Critique this recipe").click();
  if (chip) await section.getByText(chip, { exact: true }).click();
  if (note) await section.getByLabel(/Anything else/).fill(note);
  await section.getByRole("button", { name: "Suggest tweaks" }).click();
}

test("the recipe starts as the original", async ({ page }) => {
  await page.goto("/cocktails/negroni");
  await expect(ingredients(page)).toContainText("30 ml");
});

test("critique -> suggested tweaks -> trial -> keep -> original one tap away -> back to the original", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/negroni");
  await page.goto("/cocktails/negroni");
  await critique(page, "Too bitter");

  const proposal = page.locator("#critique");
  await expect(proposal.getByRole("heading", { name: "Suggested tweaks" })).toBeFocused();
  const changes = proposal.getByRole("list", { name: "What changes" });
  await expect(changes).toContainText("Bitter Campari:");
  await expect(changes.getByRole("deletion")).toHaveText("30 ml");
  await expect(changes).toContainText("20 ml");
  await expect(changes).toContainText("add 1 dash");
  await expect(proposal).toContainText("Stir a little longer");
  await expectAccessible(page);

  // Edit before saving: 22.5 ml of Campari rather than 20.
  await proposal.getByLabel("Amount for line 2").fill("22.5");
  await expect(proposal.getByLabel("Method")).toHaveValue(/Stir a little longer for more dilution\.$/);
  await proposal.getByRole("button", { name: "Save as a trial" }).click();

  await expect(page).toHaveURL(/\?tweak=saved#our-version$/);
  await expect(main(page).getByRole("status").filter({ hasText: "Saved as a trial" })).toBeVisible();
  const trial = page.getByRole("list", { name: "Trial recipe for Negroni" });
  await expect(trial).toContainText("22.5 ml");
  await expect(trial).toContainText("Orange bitters");
  await expect(trial.getByText("(changed)")).toHaveCount(2);
  // The recipe itself hasn't changed yet.
  await expect(ingredients(page)).not.toContainText("22.5 ml");
  await expectAccessible(page);

  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(page).toHaveURL(/\?tweak=kept#our-version$/);
  await expect(main(page).getByRole("status").filter({ hasText: "this is now our version" })).toBeVisible();
  await expect(ingredients(page)).toContainText("22.5 ml");
  await expect(ingredients(page)).toContainText("Orange bitters");
  await expect(page.getByRole("region", { name: "Method" })).toContainText("Stir a little longer");
  await expect(page.getByText("Trying a tweak")).toHaveCount(0);
  await page.getByText("What we changed and why").click();
  await expect(main(page)).toContainText("Less of the bitter element.");
  await expectAccessible(page);

  // Our version is the default; the original is one tap away (and keeps its view on serving changes).
  await page.getByRole("link", { name: "See the original" }).click();
  await expect(page).toHaveURL(/\?version=original$/);
  await expect(ingredients(page)).not.toContainText("22.5 ml");
  await expect(ingredients(page)).not.toContainText("Orange bitters");
  await expect(page.getByText("Critique this recipe")).toHaveCount(0);
  await page.getByRole("group", { name: "Servings" }).getByRole("link", { name: /^2/ }).click();
  await expect(page).toHaveURL(/version=original&serves=2/);
  await expect(ingredients(page)).toContainText("60 ml");
  await page.getByRole("link", { name: "Back to our version" }).click();
  await expect(ingredients(page)).toContainText("22.5 ml");

  // Go back to the original for good.
  await page.getByText("Go back to the original").click();
  await page.getByRole("button", { name: "Use the original again" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "Back to the original recipe." })).toBeVisible();
  await expect(ingredients(page)).not.toContainText("22.5 ml");
  await expect(page.getByText("Our version", { exact: true })).toHaveCount(0);
});

test("drop a trial, critique the trial, and a critique with nothing to change", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/negroni");
  await page.goto("/cocktails/negroni");
  await critique(page, null, "NO CHANGE please");
  await expect(page.locator("#critique")).toContainText("didn't suggest any changes");

  await page.goto("/cocktails/negroni");
  await critique(page, "Too bitter");
  await page.getByRole("button", { name: "Save as a trial" }).click();
  await expect(page.getByText("Trying a tweak")).toBeVisible();

  // Critiquing the trial itself suggests the next small step from it.
  await page.getByText("Still not right? Tweak the trial").click();
  const trialBox = page.locator("#our-version");
  await trialBox.getByText("Too bitter", { exact: true }).click();
  await trialBox.getByRole("button", { name: "Suggest tweaks" }).click();
  await expect(trialBox.getByRole("list", { name: "What changes" })).toContainText("25 ml");
  await expect(trialBox.getByLabel("Method")).toHaveValue(/^Build over ice/);

  await page.getByRole("button", { name: "Drop it" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "Dropped the trial." })).toBeVisible();
  await expect(page.getByText("Trying a tweak")).toHaveCount(0);
  await expect(ingredients(page)).toContainText("30 ml");
});

test("a stale page can't replace the other taster's newer trial", async ({ page, context }) => {
  await signIn(page, JOHN, "/cocktails/negroni");
  await page.goto("/cocktails/negroni");
  await critique(page, "Too bitter");
  await expect(page.getByRole("button", { name: "Save as a trial" })).toBeVisible();

  // Meanwhile, on the other phone, a trial is saved.
  const other = await context.newPage();
  await other.goto("/cocktails/negroni");
  await critique(other, "Too sweet");
  await other.getByRole("button", { name: "Save as a trial" }).click();
  await expect(other.getByText("We said: Too sweet")).toBeVisible();

  // The first page's save would silently replace it, so it's refused.
  await page.getByRole("button", { name: "Save as a trial" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "That had already changed" })).toBeVisible();
  await expect(page.getByText("We said: Too sweet")).toBeVisible();
  await page.getByRole("button", { name: "Drop it" }).click();
  await expect(page.getByText("Trying a tweak")).toHaveCount(0);
});

test("only tasters can write versions (RLS in the mock)", async ({ request }) => {
  const res = await request.post(`${MOCK_URL}/rest/v1/cocktail_versions`, {
    data: { cocktail_id: "x", ingredients: [{ amount: "1", unit: "", ingredient: "x" }], created_by: "taster-jb" },
  });
  expect(res.status()).toBe(403);
});
