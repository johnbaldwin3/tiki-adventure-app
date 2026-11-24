import { expect, test, type Page } from "@playwright/test";
import { FRAN, lastEmailCode, signIn } from "./auth";

// Invite links (migration 0019). Specs start signed in as John (e2e/auth.setup.ts).

async function makeInvite(page: Page, note: string): Promise<string> {
  await page.goto("/settings");
  await page.getByLabel(/Who is it for/).fill(note);
  await page.getByRole("button", { name: "Make an invite link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invite link ready" })).toBeVisible();
  const link = await page.getByLabel(`Invite link for ${note}`).inputValue();
  expect(link).toMatch(/\/join\/[0-9a-f]{64}$/);
  // "Email it" opens the inviter's own mail app with the link filled in.
  const mail = await page.getByRole("listitem").filter({ hasText: note }).getByRole("link", { name: "Email it" }).getAttribute("href");
  expect(mail).toMatch(/^mailto:\?subject=John%20invited%20you/);
  expect(decodeURIComponent(mail!)).toContain(link);
  // "Copy email" puts the same email on the clipboard, for any other email service.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("listitem").filter({ hasText: note }).getByRole("button", { name: "Copy email" }).click();
  await expect(page.getByText("Email copied!")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/^Subject: John invited you to Equal Parts\n\n/);
  expect(copied).toContain(link);
  return new URL(link).pathname;
}

test("a friend joins with an invite link, and lands on the welcome screen", async ({ page }, testInfo) => {
  const run = `${testInfo.project.name}-${testInfo.retry}-${testInfo.repeatEachIndex}`;
  const who = `Pat ${run}`;
  const email = `joiner-${run}@e2e.test`;
  const path = await makeInvite(page, who);

  await page.context().clearCookies();
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "John invited you" })).toBeVisible();
  // A typo first: asking again with the right email moves the claim.
  await page.getByLabel("Your name").fill(who);
  await page.getByLabel("Email").fill(`typo-${email}`);
  await page.getByRole("button", { name: "Join and email me a code" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  await page.getByRole("button", { name: "Use a different email" }).click();
  await expect(page.getByLabel("Your name")).toHaveValue(who);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Join and email me a code" }).click();
  // Wait for the code step, so the email has been "sent" before reading it.
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  await page.getByLabel("Sign-in code").fill(await lastEmailCode(page, email));
  await page.getByRole("button", { name: "Join" }).click();

  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { name: `Hi, ${who}!` })).toBeVisible();
  await expect(page.getByText("You're connected with John.")).toBeVisible();

  // Members can set a password from Settings.
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("New password").fill("a-brand-new-pass");
  await page.getByLabel("Confirm password").fill("a-brand-new-pass");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Password saved" })).toBeVisible();

  // The link is spent once they've signed in.
  await page.context().clearCookies();
  await page.goto(path);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/already been used/);

  // John sees who joined.
  await signIn(page, "john@e2e.test", "/settings");
  await expect(page.getByRole("list", { name: "Your invites" })).toContainText(`Joined as ${who}`);
});

test("a cancelled invite stops working", async ({ page }, testInfo) => {
  const note = `Cancel ${testInfo.project.name} ${testInfo.retry}-${testInfo.repeatEachIndex}`;
  const path = await makeInvite(page, note);
  const item = page.getByRole("listitem").filter({ hasText: note });
  await item.getByRole("button", { name: "Cancel this invite" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Invite cancelled" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: note })).toContainText("Cancelled");

  await page.context().clearCookies();
  await page.goto(path);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/was cancelled/);
  await expect(page.getByLabel("Your name")).toHaveCount(0);
});

test("an unknown invite link says so", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`/join/${"0".repeat(64)}`);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/isn't valid/);
});

test("a member opening an invite link is told they're already in", async ({ page }) => {
  await page.goto(`/join/${"0".repeat(64)}`);
  await expect(page.getByRole("heading", { name: "You're already a member" })).toBeVisible();
});

test("the shared catalog tools are for John and Genny only", async ({ page }) => {
  await signIn(page, FRAN, "/cocktails/zombie");
  await expect(page.getByRole("heading", { level: 1, name: "Zombie" })).toBeVisible();
  await expect(page.getByText("Critique this recipe")).toHaveCount(0);
  await expect(page.getByText("Change collections")).toHaveCount(0);
  await expect(page.getByText("Fix style tags")).toHaveCount(0);
  await page.goto("/collections");
  await expect(page.getByRole("button", { name: "Add collection" })).toHaveCount(0);
});
