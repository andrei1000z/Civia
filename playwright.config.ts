import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config — smoke tests pentru critical flows.
 * (P3.655-656 — 2026-05-24)
 *
 * Rulare:
 *   npx playwright install (first time)
 *   npx playwright test (toate)
 *   npx playwright test --ui (cu UI debug)
 *   npx playwright test --grep "submit-anonim" (single test)
 *
 * CI: rulează în GitHub Actions după build, doar pe smoke tests
 * (nu vrem să blochezi PR-uri pentru flakiness E2E).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ro-RO",
    timezoneId: "Europe/Bucharest",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] },
    },
  ],

  // Webserver doar dacă rulează local cu baseURL=localhost.
  // CI folosește deploy preview Vercel direct (PLAYWRIGHT_BASE_URL setat).
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
      }),
});
