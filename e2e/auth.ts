import { expect, type Page } from "@playwright/test";

// Fake accounts that exist only in e2e/mock-supabase.mjs.
export const E2E_PASSWORD = "tiki-e2e-pass-1";
export const JOHN = "john@e2e.test";
export const GENNY = "genny@e2e.test";
export const MOCK_URL = "http://127.0.0.1:54329";

export async function signIn(page: Page, email: string, next = "/") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/^Signed in as/)).toBeVisible();
}

/** The most recent link the mock "emailed" to this address. */
export async function lastEmailLink(page: Page, to: string): Promise<string> {
  const res = await page.request.get(`${MOCK_URL}/__mock/outbox?to=${encodeURIComponent(to)}`);
  const mails = (await res.json()) as { link: string }[];
  expect(mails.length).toBeGreaterThan(0);
  return mails[mails.length - 1].link;
}
