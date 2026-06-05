import { test as setup, expect } from "@playwright/test";

// Einmaliger Mock-Login; speichert den Cookie als storageState für alle Tests.
const authFile = "e2e/.auth/user.json";

setup("mock login", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Demo Teamlead" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
