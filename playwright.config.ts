import { defineConfig, devices } from "@playwright/test";

// Smoke-Suite für die Kernpfade (Mock-Login, Listen, Detail, Suche, Inline-Edit,
// Dialoge). Läuft seriell (ein Worker), weil ein Test schreibend am Testticket
// 43180 arbeitet. Mock-Auth: Login einmal im Setup, Cookie als storageState geteilt.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  // Startet den Dev-Server, falls noch keiner läuft (sonst wird er wiederverwendet).
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
