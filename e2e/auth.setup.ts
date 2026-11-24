import { test as setup } from "@playwright/test";
import { JOHN, signIn } from "./auth";

// The app is members-only (signed out you get the landing page), so specs
// start signed in as John; ones about signing in or out start fresh.
export const MEMBER_STATE = "e2e/.auth/john.json";

setup("sign in as John", async ({ page }) => {
  await signIn(page, JOHN);
  await page.context().storageState({ path: MEMBER_STATE });
});
