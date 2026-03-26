import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * Tests critical user flows in production-like environment
 */

const PORT = process.env.PORT || 3000;
const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // Increase timeout for job completion tests (accounts for Inngest retries)
  timeout: 60_000, // 60 seconds

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run dev server before tests
  webServer: [
    {
      command: "npx inngest-cli@latest dev",
      url: "http://localhost:8288",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        INNGEST_DEV: "true",
        INNGEST_BASE_URL: "http://localhost:8288",
        NODE_TLS_REJECT_UNAUTHORIZED: "0", // Allow SSL issues with test sites
      },
    },
  ],
});
