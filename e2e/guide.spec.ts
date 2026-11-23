import { test, expect } from "@playwright/test";
import { GENNY, signIn } from "./auth";

test("the guide is linked from the header on every page and jumps to its sections", async ({ page }) => {
  await page.goto("/stats");
  await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Help" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { level: 1, name: "How Equal Parts works" })).toBeVisible();

  const jump = page.getByRole("navigation", { name: "Jump to" });
  await jump.getByRole("link", { name: /Our bar/ }).click();
  await expect(page).toHaveURL(/\/guide#bar$/);
  await expect(page.getByRole("heading", { level: 2, name: /Our bar/ })).toBeInViewport();
});

test("signed out: no welcome card on the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /New here\?/ })).toHaveCount(0);
});

test("signed in: the welcome card shows until hidden, and the guide brings it back", async ({ page }) => {
  await signIn(page, GENNY, "/");
  const card = page.getByRole("region", { name: /New here\?/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Welcome, Genny!");

  await card.getByRole("link", { name: /How Equal Parts works/ }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await page.goBack();

  await page.getByRole("region", { name: /New here\?/ }).getByRole("button", { name: "Hide this" }).click();
  await expect(page.getByRole("region", { name: /New here\?/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: /New here\?/ })).toHaveCount(0);

  await page.goto("/guide");
  await page.getByRole("button", { name: "Show it again" }).click();
  await expect(page.getByRole("status")).toContainText("it's back on the home page");
  await expect(page.getByRole("button", { name: "Hide the welcome card" })).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("region", { name: /New here\?/ })).toBeVisible();
});
