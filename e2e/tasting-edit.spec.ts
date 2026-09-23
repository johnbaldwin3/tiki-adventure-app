import { test, expect } from "@playwright/test";
import { GENNY, JOHN, signIn } from "./auth";

// The mock keeps writes in memory for the whole run, and projects run in
// parallel, so each project edits its own tried-but-unrated cocktail with a
// low rating (so it can't disturb the "Tiki Max is #1" assertions elsewhere).
const TARGET: Record<string, { slug: string; name: string }> = {
  chromium: { slug: "nui-nui", name: "Nui Nui" },
  "mobile-chrome": { slug: "hawaiian-eye", name: "Hawaiian Eye" },
};

test("add a rating, date and notes from the recipe card", async ({ page }, testInfo) => {
  const { slug, name } = TARGET[testInfo.project.name];
  await signIn(page, JOHN, `/cocktails/${slug}`);

  const tasting = page.getByRole("region", { name: "Our tasting" });
  await tasting.getByRole("link", { name: /Add rating & notes for John|Edit for John/ }).click();

  await expect(page).toHaveURL(new RegExp(`/cocktails/${slug}/tasting/jb$`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /I've tried this/ })).toBeChecked();

  await page.getByLabel("Rating").fill("5.25");
  await page.getByLabel("Date tasted").fill("2026-09-01");
  await page.getByLabel("Notes").fill(`e2e note for ${testInfo.project.name}`);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(new RegExp(`/cocktails/${slug}#tasting$`));
  const john = page.getByRole("region", { name: "Our tasting" }).getByRole("listitem").first();
  await expect(john).toContainText("5.25");
  await expect(john).toContainText("Tasted Sep 1, 2026");
  await expect(john).toContainText(`e2e note for ${testInfo.project.name}`);
  await expect(john.getByRole("link", { name: /Edit for John/ })).toBeVisible();

  // The edit form comes back pre-filled with what was saved.
  await john.getByRole("link", { name: /Edit for John/ }).click();
  await expect(page.getByLabel("Rating")).toHaveValue("5.25");
  await expect(page.getByLabel("Date tasted")).toHaveValue("2026-09-01");

  // Clearing fields saves them back to empty.
  await page.getByLabel("Rating").fill("");
  await page.getByLabel("Date tasted").fill("");
  await page.getByLabel("Notes").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/cocktails/${slug}#tasting$`));
  const johnAgain = page.getByRole("region", { name: "Our tasting" }).getByRole("listitem").first();
  await expect(johnAgain).toContainText("Tried — not rated yet");
  await expect(johnAgain).toContainText("No notes yet.");
  await expect(johnAgain).not.toContainText("Tasted Sep");
});

test("invalid input shows field errors and keeps what was typed", async ({ page }) => {
  await signIn(page, GENNY, "/cocktails/zombie/tasting/gm");
  await expect(page.getByRole("checkbox", { name: /I've tried this/ })).not.toBeChecked();

  await page.getByLabel("Rating").fill("11");
  await page.getByLabel("Notes").fill("Want to try this");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Please fix" })).toContainText(
    "Please fix the highlighted fields"
  );
  const rating = page.getByLabel("Rating");
  await expect(rating).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/rating from 0 to 10/)).toBeVisible();
  await expect(rating).toHaveValue("11");
  await expect(page.getByLabel("Notes")).toHaveValue("Want to try this");
  await expect(page).toHaveURL(/\/cocktails\/zombie\/tasting\/gm$/);
  // Focus moves to the first invalid field so it's obvious what to fix.
  await expect(rating).toBeFocused();
});

test("Cancel returns to the card without saving", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/zombie/tasting/jb");
  await page.getByLabel("Notes").fill("should not be saved");
  await page.getByRole("link", { name: "Cancel" }).click();
  await expect(page).toHaveURL(/\/cocktails\/zombie#tasting$/);
  await expect(page.getByText("should not be saved")).toHaveCount(0);
});

test("an unknown taster shows the not-found page", async ({ page }) => {
  await signIn(page, JOHN, "/cocktails/zombie/tasting/xx");
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
});

test("edit form fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page, GENNY, "/cocktails/tiki-max/tasting/gm");
  await expect(page.getByLabel("Rating")).toHaveValue("9.41");
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalScroll).toBe(false);
});
