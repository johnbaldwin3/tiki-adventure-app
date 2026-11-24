import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { GENNY, signIn, SIGNED_OUT } from "./auth";

// Automated WCAG 2.1 A/AA checks (axe-core) on every page, signed out and
// signed in, including form-validation errors (database-down states are
// scanned in db-down.spec.ts). Axe catches roughly a third to a half
// of accessibility issues; the rest is covered by the role/label-based
// assertions throughout the other specs.
async function expectNoViolations(page: Page) {
  // Next streams <title> in after the body; wait for it so axe doesn't
  // scan a half-rendered page mid-navigation.
  await expect(page).toHaveTitle(/Equal Parts/);
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
  "/?ing=aged-jamaican-rum,falernum&match=any",
  "/?ing=navy-rum,falernum",
  "/cocktails/tiki-max",
  "/cocktails/zombie",
  "/cocktails/zombie?serves=4&units=oz",
  "/stats",
  "/guide",
  "/ingredients",
  "/ingredients/aged-jamaican-rum",
  "/ingredients/lime",
  "/ingredients/unicorn-tears",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/settings",
  "/welcome",
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

  await page.goto("/cocktails/zombie/tasting/jb"); // entering the other taster's tasting
  await expectNoViolations(page);
});

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("a11y: sign-in with a code (email step error, then code step)", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expectNoViolations(page);
    await page.getByLabel("Email").fill("genny@e2e.test");
    await page.getByRole("button", { name: "Email me a sign-in code" }).click();
    await expect(page.getByLabel("Sign-in code")).toBeFocused();
    await expectNoViolations(page);
  });

  test("a11y: joining by invite link (with a field error)", async ({ page, browser }) => {
    // John makes a real link in his own session, then this signed-out page opens it.
    const john = await browser.newContext({ storageState: "e2e/.auth/john.json", baseURL: test.info().project.use.baseURL });
    const jp = await john.newPage();
    await jp.goto("/settings");
    await jp.getByRole("button", { name: "Make an invite link" }).click();
    const link = await jp.getByLabel("Invite link for Invite").first().inputValue();
    await john.close();
    await page.goto(new URL(link).pathname);
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Join and email me a code" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expectNoViolations(page);
  });

  test("a11y: sign-in error state", async ({ page }) => {
    await page.goto("/login?with=password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expectNoViolations(page);
  });
});
