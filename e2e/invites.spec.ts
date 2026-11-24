import { expect, test, type Page } from "@playwright/test";
import { FRAN, JOHN, lastEmailCode, MOCK_URL, signIn } from "./auth";

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

/** App emails (via the mock's Resend stand-in) sent to this address. */
async function appEmails(page: Page, to: string): Promise<{ subject: string; text: string }[]> {
  const res = await page.request.get(`${MOCK_URL}/__mock/outbox?to=${encodeURIComponent(to)}`);
  return ((await res.json()) as { type: string; subject: string; text: string }[]).filter((m) => m.type === "app");
}

/** Fran (not an admin) makes a link: it waits for an admin, with no link to copy yet. */
async function franMakesInvite(page: Page, note: string) {
  await signIn(page, FRAN, "/settings");
  await page.getByLabel(/Who is it for/).fill(note);
  await page.getByRole("button", { name: "Make an invite link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "An admin needs to approve it first" })).toBeVisible();
  const item = page.getByRole("listitem").filter({ hasText: note });
  await expect(item).toContainText("Waiting for an admin to approve");
  await expect(page.getByLabel(`Invite link for ${note}`)).toHaveCount(0);
  // The admins hear about it by email.
  await expect.poll(async () => (await appEmails(page, JOHN)).some((m) => m.text.includes(`Fran made an invite link for ${note}.`))).toBe(true);
}

test("a friend's invite waits for an admin, then works once approved", async ({ page }, testInfo) => {
  const note = `Approve ${testInfo.project.name} ${testInfo.retry}-${testInfo.repeatEachIndex}`;
  await franMakesInvite(page, note);

  // John sees a badge on Settings, and approves it there.
  await signIn(page, JOHN, "/");
  await page.getByRole("link", { name: /Settings \(\d+ invites? needs? your approval\)/ }).click();
  await expect(page).toHaveURL(/\/settings#approvals$/);
  await page.getByRole("button", { name: `Approve Fran's invite for ${note}` }).click();
  await expect(page.getByRole("status").filter({ hasText: "Approved" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Invites to approve" }).getByText(note)).toHaveCount(0);

  // Fran gets an email, and her link is ready to send.
  await expect.poll(async () => (await appEmails(page, FRAN)).some((m) => m.subject === `Your Equal Parts invite for ${note} is ready`)).toBe(true);
  await signIn(page, FRAN, "/settings");
  const link = await page.getByLabel(`Invite link for ${note}`).inputValue();
  await page.context().clearCookies();
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole("heading", { name: "Fran invited you" })).toBeVisible();
});

test("an admin can decline a friend's invite", async ({ page }, testInfo) => {
  const note = `Decline ${testInfo.project.name} ${testInfo.retry}-${testInfo.repeatEachIndex}`;
  await franMakesInvite(page, note);
  await signIn(page, JOHN, "/settings");
  await page.getByRole("button", { name: `Decline Fran's invite for ${note}` }).click();
  await expect(page.getByRole("status").filter({ hasText: "Declined" })).toBeVisible();
  await signIn(page, FRAN, "/settings");
  await expect(page.getByRole("listitem").filter({ hasText: note })).toContainText("Not approved");
});

test("only admins see invites to approve", async ({ page }) => {
  await signIn(page, FRAN, "/settings");
  await expect(page.getByRole("heading", { name: "Invites to approve" })).toHaveCount(0);
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
