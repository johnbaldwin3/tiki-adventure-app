import { test, expect } from "@playwright/test";

test("home links to the ingredients browser, grouped by family", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Browse ingredients/ }).click();
  await expect(page).toHaveURL(/\/ingredients$/);
  await expect(page).toHaveTitle(/Ingredients · Adventures in Tiki/);
  await expect(page.getByRole("heading", { level: 1, name: "Ingredients" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Rum" })).toBeVisible();

  // Jump links reach each family section.
  await page.getByRole("navigation", { name: "Jump to a family" }).getByRole("link", { name: "Bitters" }).click();
  await expect(page).toHaveURL(/#bitters$/);

  // Staples are labelled; counts come from the recipes.
  const lime = page.getByRole("link", { name: /Lime \/ lime juice \(fresh\)/ });
  await expect(lime).toContainText("Staple");
  await expect(lime).toContainText(/\d+ drinks/);
});

test("an ingredient page shows the style, bottles to buy with source, and the drinks that use it", async ({ page }) => {
  await page.goto("/ingredients/aged-jamaican-rum");
  await expect(page).toHaveTitle(/Aged Jamaican rum \(funky\)/);
  await expect(page.getByRole("heading", { level: 1, name: "Aged Jamaican rum (funky)" })).toBeVisible();
  await expect(page.getByText(/tell-tale 'funk'/)).toBeVisible();

  const brands = page.getByRole("region", { name: "Bottles to look for" });
  await expect(brands.getByText("Crossfire Hurricane Gold")).toBeVisible();
  await expect(brands.getByRole("link", { name: /Difford's Guide's list/ })).toHaveAttribute(
    "href",
    /diffordsguide\.com\/beer-wine-spirits\/category\/1543\//
  );

  const drinks = page.getByRole("region", { name: /Used in 15 drinks/ }).getByRole("listitem");
  await expect(drinks).toHaveCount(15);
  await expect(drinks.filter({ hasText: "Zombie" })).toHaveCount(1);

  await page.getByText(/Written in the recipes as/).click();
  await expect(page.getByText("Crossfire Hurricane Jamaican Rum")).toBeVisible();

  await drinks.filter({ hasText: "Zombie" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/cocktails\/zombie$/);
});

test("recipe card ingredients link to their ingredient page", async ({ page }) => {
  await page.goto("/cocktails/tiki-max");
  await page
    .getByRole("region", { name: "Ingredients" })
    .getByRole("link", { name: "Navy rum (ideally 54.5% alc./vol.)", exact: true })
    .click();
  await expect(page).toHaveURL(/\/ingredients\/navy-rum$/);
  await expect(page.getByText("Pusser's Gunpowder Proof (54.5%)")).toBeVisible();
  await expect(page.getByRole("link", { name: /Tiki Max/ })).toBeVisible();
});

test("a staple ingredient says so", async ({ page }) => {
  await page.goto("/ingredients/angostura-bitters");
  await expect(page.getByText("Staple: assumed always on hand")).toBeVisible();
});

test("an unknown ingredient shows a friendly 404", async ({ page }) => {
  await page.goto("/ingredients/unicorn-tears");
  await expect(page.getByRole("heading", { name: "Ingredient not found" })).toBeVisible();
});

test("ingredient pages fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/ingredients", "/ingredients/overproof-aged-pot-rum"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  }
});

test("drinks where the ingredient is optional are labelled", async ({ page }) => {
  await page.goto("/ingredients/xanthan-gum");
  await expect(page.getByText("Optional in this recipe").first()).toBeVisible();
});
