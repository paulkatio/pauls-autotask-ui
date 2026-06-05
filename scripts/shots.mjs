// Farbsystem v2 – Screenshot-Lauf (Hell/Dunkel/Mobile).
// Voraussetzung: Dev-Server auf http://localhost:3000 (npm run dev).
// Aufruf: node scripts/shots.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "docs/visual-refresh/v2";
mkdirSync(OUT, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function settle(page) {
  try { await page.waitForLoadState("networkidle", { timeout: 20000 }); } catch {}
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();

// 1) Einmal Mock-Login -> storageState
const ctx0 = await browser.newContext({ viewport: DESKTOP });
const p0 = await ctx0.newPage();
await p0.goto(`${BASE}/login`);
await p0.getByRole("button", { name: "Demo Teamlead" }).click();
await p0.waitForURL(`${BASE}/`);
await settle(p0);
// Firmen-Detail-ID (Kundenakte) aus der Firmenliste ziehen
await p0.goto(`${BASE}/companies`);
await settle(p0);
let companyHref = "/companies";
try {
  companyHref = await p0.locator('a[href^="/companies/"]').first().getAttribute("href");
} catch {}
const storageState = await ctx0.storageState();
await ctx0.close();
console.log("Kundenakte:", companyHref);

const TICKET = 43180;

async function shoot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("  ✓", name);
}

for (const mode of ["light", "dark"]) {
  // Desktop
  const ctx = await browser.newContext({ viewport: DESKTOP, storageState });
  await ctx.addInitScript((m) => localStorage.setItem("theme", m), mode);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/`); await settle(page);
  await shoot(page, `${mode}-desktop-01-dashboard`);

  await page.goto(`${BASE}/tickets/team`); await settle(page);
  await shoot(page, `${mode}-desktop-02-ticketliste`);

  await page.goto(`${BASE}/tickets/${TICKET}`); await settle(page);
  await shoot(page, `${mode}-desktop-03-ticketdetail`);

  await page.goto(`${BASE}${companyHref}`); await settle(page);
  await shoot(page, `${mode}-desktop-04-kundenakte`);

  // Command-Palette offen (Viewport-Shot, mittig)
  await page.goto(`${BASE}/`); await settle(page);
  await page.keyboard.press("Control+k");
  try {
    const input = page.getByRole("textbox", { name: "Suche" });
    await input.waitFor({ timeout: 8000 });
    await input.fill("Phase-0");
    await page.waitForTimeout(1500);
  } catch {}
  await page.screenshot({ path: `${OUT}/${mode}-desktop-05-command-palette.png` });
  console.log("  ✓", `${mode}-desktop-05-command-palette`);
  await ctx.close();

  // Mobile
  const mctx = await browser.newContext({ viewport: MOBILE, storageState, isMobile: true, hasTouch: true });
  await mctx.addInitScript((m) => localStorage.setItem("theme", m), mode);
  const mp = await mctx.newPage();

  await mp.goto(`${BASE}/`); await settle(mp);
  await shoot(mp, `${mode}-mobile-01-dashboard`);

  await mp.goto(`${BASE}/tickets/team`); await settle(mp);
  await shoot(mp, `${mode}-mobile-02-ticketliste`);

  await mp.goto(`${BASE}/tickets/${TICKET}`); await settle(mp);
  await shoot(mp, `${mode}-mobile-03-ticketdetail`);

  await mctx.close();
}

await browser.close();
console.log("Fertig ->", OUT);
