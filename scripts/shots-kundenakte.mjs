// Nachschuss: Kundenakte-Detail (Hell/Dunkel, Desktop). Klickt die erste
// Firmenzeile (router.push /companies/:id). Dev-Server :3000 vorausgesetzt.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = "docs/visual-refresh/v2";
const DESKTOP = { width: 1440, height: 900 };

async function settle(page) {
  try { await page.waitForLoadState("networkidle", { timeout: 20000 }); } catch {}
  await page.waitForTimeout(900);
}

const browser = await chromium.launch();
const ctx0 = await browser.newContext({ viewport: DESKTOP });
const p0 = await ctx0.newPage();
await p0.goto(`${BASE}/login`);
await p0.getByRole("button", { name: "Demo Teamlead" }).click();
await p0.waitForURL(`${BASE}/`);
const storageState = await ctx0.storageState();
await ctx0.close();

for (const mode of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: DESKTOP, storageState });
  await ctx.addInitScript((m) => localStorage.setItem("theme", m), mode);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/companies`);
  await settle(page);
  await page.locator("tr.cursor-pointer").first().click();
  await page.waitForURL(/\/companies\/\d+/, { timeout: 15000 });
  // Auf echten Inhalt warten (Skeleton verschwindet): ein Tab oder eine Section.
  try {
    await page.getByRole("tab").first().waitFor({ timeout: 25000 });
  } catch {}
  try {
    await page.locator('[class*="animate-pulse"]').first().waitFor({ state: "detached", timeout: 25000 });
  } catch {}
  await settle(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${mode}-desktop-04-kundenakte.png`, fullPage: true });
  console.log("✓", mode, "->", page.url());
  await ctx.close();
}
await browser.close();
