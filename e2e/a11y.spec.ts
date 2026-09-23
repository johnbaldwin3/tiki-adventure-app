import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { GENNY, signIn } from "./auth";

// Automated WCAG 2.1 A/AA checks (axe-core) on every page, signed out and
// signed in, including form-validation errors (database-down states are
// scanned in db-down.spec.ts). Axe catches roughly a third to a half
// of accessibility issues; the rest is covered by the role/label-based
// assertions throughout the other specs.
async function expectNoViolations(page: Page) {
  // Next streams <title> in after the body; wait for it so axe doesn't
  // scan a half-rendered page mid-navigation.
  await expect(page).toHaveTitle(/Adventures in Tiki/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`
  );
  expect(summary).toEqual([]);
}

const signedOutPages = [
  "/",
  "/?show=tasted",
  "/?show=untasted",
  "/cocktails/tiki-max",
  "/cocktails/zombie",
  "/stats",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/this-does-not-exist",
  "/cocktails/not-a-real-drink",
];

for (const path of signedOutPages) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoViolations(page);
  });
}

test("a11y: signed-in card, edit form, and form errors", async ({ page }) => {
  await signIn(page, GENNY, "/cocktails/tiki-max");
  await expectNoViolations(page);

  await page.goto("/cocktails/zombie/tasting/gm");
  await expectNoViolations(page);

  await page.getByLabel("Rating").fill("11");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/rating from 0 to 10/)).toBeVisible();
  await expectNoViolations(page);

  await page.goto("/cocktails/zombie/tasting/jb"); // "Not your tasting"
  await expectNoViolations(page);
});

test("a11y: sign-in error state", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expectNoViolations(page);
});
