import { test, expect } from "@playwright/test";

test("scale servings and switch units on a recipe card; the unit choice is remembered", async ({ page }) => {
  await page.goto("/cocktails/painkiller");
  const ingredients = page.getByRole("region", { name: "Ingredients" });
  const firstAmount = ingredients.getByRole("listitem").first();
  await expect(firstAmount).toContainText("1 1/2 fl oz");

  await page.getByRole("group", { name: "Servings" }).getByRole("link", { name: "2 drinks" }).click();
  await expect(page).toHaveURL(/\/cocktails\/painkiller\?serves=2$/);
  await expect(page.getByRole("heading", { name: /Ingredients · for 2 drinks/ })).toBeVisible();
  await expect(firstAmount).toContainText("3 fl oz");
  await expect(page.getByRole("group", { name: "Servings" }).getByRole("link", { name: "2 drinks" })).toHaveAttribute(
    "aria-current",
    "true"
  );
  // Counted amounts scale to whole numbers.
  await expect(ingredients.getByRole("listitem").last()).toContainText("8 drops");

  await page.getByRole("group", { name: "Units" }).getByRole("link", { name: "ml" }).click();
  await expect(page).toHaveURL(/\?serves=2&units=ml$/);
  await expect(firstAmount).toContainText("90 ml");
  await expect(page.getByText(/Converted at the bar standard 1 fl oz = 30 ml/)).toBeVisible();

  // Another card opens in ml (remembered), at 1 serving.
  await page.goto("/cocktails/zombie");
  await expect(page.getByRole("group", { name: "Units" }).getByRole("link", { name: "ml" })).toHaveAttribute(
    "aria-current",
    "true"
  );
  await expect(page.getByRole("region", { name: "Ingredients" }).getByRole("listitem").first()).toContainText(/\d ml/);

  // Back to as written.
  await page.getByRole("group", { name: "Units" }).getByRole("link", { name: "As written" }).click();
  await expect(page.getByRole("region", { name: "Ingredients" }).getByRole("listitem").first()).toContainText("fl oz");

  // Bad params fall back: servings to 1, units to the remembered choice.
  await page.getByRole("group", { name: "Units" }).getByRole("link", { name: "ml" }).click();
  await page.goto("/cocktails/painkiller?serves=999&units=cups");
  await expect(firstAmount).toContainText("45 ml");
  // Barspoons (xanthan gum, a powder) are never converted.
  await page.goto("/cocktails/zombie?units=ml");
  await expect(page.getByRole("region", { name: "Ingredients" })).toContainText("1/4 barspoon");
});

test("a unit link that's only seen (prefetch) never changes the remembered unit", async ({ page, context }) => {
  await page.goto("/cocktails/painkiller");
  await page.getByRole("group", { name: "Units" }).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  expect((await context.cookies()).find((c) => c.name === "tiki-units")).toBeUndefined();
});
