import { test, expect } from "@playwright/test";
import { E2E_PASSWORD, GENNY, JOHN, lastEmailCode, lastEmailLink, signIn } from "./auth";

test("signed out: cards are read-only with a sign-in prompt", async ({ page }) => {
  await page.goto("/cocktails/tiki-max");
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
  const tasting = page.getByRole("region", { name: "Our tasting" });
  await expect(tasting.getByRole("link", { name: /Edit|Add rating/ })).toHaveCount(0);
  await expect(page.getByText("to see our ratings and add yours.")).toBeVisible();
  // Ratings are private: no one's tasting shows signed out.
  await expect(tasting.getByText("John", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/9\.41/)).toHaveCount(0);

  // The edit page itself sends you to sign in, then back.
  await page.goto("/cocktails/tiki-max/tasting/jb");
  await expect(page).toHaveURL(/\/login\?next=%2Fcocktails%2Ftiki-max%2Ftasting%2Fjb$/);
});

test("wrong password shows a friendly error; the right one signs in and returns to next", async ({ page }) => {
  await page.goto("/login?with=password&next=%2Fcocktails%2Ftiki-max");
  await page.getByLabel("Email").fill(JOHN);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(JOHN);

  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/cocktails\/tiki-max$/);
  await expect(page.getByText("Signed in as John")).toBeVisible();

  // Only John's own tasting is editable.
  const tasting = page.getByRole("region", { name: "Our tasting" });
  await expect(tasting.getByRole("link", { name: /for John/ })).toBeVisible();
  await expect(tasting.getByRole("link", { name: /for Genny/ })).toHaveCount(0);
});

test("sign-in lasts at least 14 days (session cookie expiry)", async ({ page, context }) => {
  await signIn(page, JOHN);
  const authCookies = (await context.cookies()).filter((c) => /^sb-.*-auth-token/.test(c.name));
  expect(authCookies.length).toBeGreaterThan(0);
  const fourteenDays = Date.now() / 1000 + 14 * 24 * 60 * 60;
  for (const c of authCookies) expect(c.expires).toBeGreaterThan(fourteenDays);
});

test("either taster can open the other's tasting form (household rule)", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/zombie/tasting/gm");
  await expect(page.getByText("You're entering Genny's rating & notes.")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Genny has tried this/ })).toBeVisible();
});

test("sign out", async ({ page }) => {
  await signIn(page, GENNY);
  await expect(page.getByText("Signed in as Genny")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Signed in as/)).toHaveCount(0);
});

test("create an account: allowlisted email, confirm by email link, signed in", async ({ page }, testInfo) => {
  const email = `newbie-${testInfo.project.name}@e2e.test`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/at least 8 characters/).last()).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill("brand-new-pass");
  await page.getByLabel("Confirm password").fill("brand-new-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText(`emailed a confirmation link to ${email}`);

  await page.goto(await lastEmailLink(page, email));
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);
  await expect(page.getByText("Signed in as Genny")).toBeVisible();
});

test("sign-up is refused for emails not on the tasters list", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill("stranger@e2e.test");
  await page.getByLabel("Password", { exact: true }).fill("brand-new-pass");
  await page.getByLabel("Confirm password").fill("brand-new-pass");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "isn't on the tasters list" })).toBeVisible();
});

test("forgot password: email link, choose a new one, sign in with it", async ({ page }, testInfo) => {
  const email = `reset-${testInfo.project.name}@e2e.test`;
  await page.goto("/login?with=password");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link is on its way");

  await page.goto(await lastEmailLink(page, email));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password", { exact: true }).fill("fresh-password-2");
  await page.getByLabel("Confirm new password").fill("fresh-password-2");
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/\?password=updated$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login?with=password");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("fresh-password-2");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/^Signed in as/)).toBeVisible();
});

test("a short-lived token is refreshed on navigation and you stay signed in", async ({ page, context }, testInfo) => {
  test.setTimeout(60_000);
  const email = `refresh-${testInfo.project.name}@e2e.test`;
  await signIn(page, email);
  const tokenCookie = async () =>
    (await context.cookies())
      .filter((c) => /^sb-.*-auth-token/.test(c.name))
      .map((c) => c.value)
      .join("");
  const before = await tokenCookie();
  // The mock issues this account 100s tokens; after 11s they're inside the
  // 90s refresh margin, so the proxy must refresh and re-set the cookie.
  await page.waitForTimeout(11_000);
  await page.goto("/stats");
  await expect(page.getByText(/^Signed in as/)).toBeVisible();
  expect(await tokenCookie()).not.toBe(before);
  // ...and the refreshed session keeps working on the next page.
  await page.goto("/cocktails/zombie");
  await expect(page.getByText("Signed in as Genny")).toBeVisible();
});

test("the change-password form needs a fresh reset link, not just a session", async ({ page }) => {
  await signIn(page, GENNY, "/reset-password");
  await expect(page.getByText("This page needs the link from your reset email.")).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
});

test("a link opened in a different browser than the one that asked for it doesn't sign in", async ({ page, browser }) => {
  // Any of Genny's reset links will do: none was requested from the new browser.
  const email = GENNY;
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("reset link is on its way");
  const link = await lastEmailLink(page, email);

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(link);
  await expect(otherPage).toHaveURL(/\/login\?error=link$/);
  await other.close();
});

test("an expired or reused email link says so", async ({ page }) => {
  await page.goto("/auth/confirm?code=not-a-real-code&next=/");
  await expect(page).toHaveURL(/\/login\?error=link$/);
  await expect(page.getByRole("alert").filter({ hasText: "expired or was already used" })).toBeVisible();
});

test("login page rejects off-site redirects", async ({ page }) => {
  await signIn(page, JOHN, "https://evil.example/");
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);
});

test("sign in with an emailed code: wrong code, then the right one returns to next", async ({ page }, testInfo) => {
  // A per-project account, so parallel projects don't replace each other's codes.
  const email = `reset-${testInfo.project.name}@e2e.test`;
  await page.goto("/login?next=%2Fcocktails%2Fzombie");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByRole("status")).toContainText(`emailed a sign-in code to ${email}`);
  await expect(page.getByLabel("Sign-in code")).toBeFocused();

  await page.getByLabel("Sign-in code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();

  // A new code replaces the old one.
  await page.getByRole("button", { name: "Send a new code" }).click();
  await expect(page.getByRole("status")).toContainText("emailed a sign-in code");
  await page.getByLabel("Sign-in code").fill(await lastEmailCode(page, email));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/cocktails\/zombie$/);
  await expect(page.getByText(/^Signed in as/)).toBeVisible();
});

test("code sign-in: no account for that email, and 'use a different email' goes back", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("stranger@e2e.test");
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "no account for that email" })).toBeVisible();

  await page.getByLabel("Email").fill(JOHN);
  await page.getByRole("button", { name: "Email me a sign-in code" }).click();
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Email")).toHaveValue(JOHN);
  await expect(page.getByLabel("Sign-in code")).toHaveCount(0);
});

test("the password form is still there for anyone who has one", async ({ page }) => {
  await page.goto("/login?next=%2Fstats");
  await page.getByRole("link", { name: "Use a password instead" }).click();
  await expect(page).toHaveURL(/\/login\?with=password&next=%2Fstats$/);
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("link", { name: "Email me a code instead" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fstats$/);
});
