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

  // Timeout for tests (90 seconds for minimal crawl jobs)
  timeout: 90_000, // 90 seconds

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run dev server before tests
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "",
      GROQ_API_KEY: process.env.GROQ_API_KEY || "",
      INNGEST_DEV: process.env.INNGEST_DEV || "",
      INNGEST_BASE_URL: process.env.INNGEST_BASE_URL || "",
      NODE_TLS_REJECT_UNAUTHORIZED:
        process.env.NODE_TLS_REJECT_UNAUTHORIZED || "",
    },
  },
});
