import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, ".env.test") });

// Test user credentials from .env.test
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "isaiahdupree33@gmail.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "Frogger12";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"], ["./tests/timeout-reporter.ts"]],
  timeout: 15000,
  expect: {
    timeout: 15000,
  },
  
  // Global setup - checks services are healthy before running tests
  globalSetup: process.env.SKIP_HEALTH_CHECK ? undefined : "./tests/global-setup.ts",
  
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3939",
    headless: false,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Pass test credentials to all tests
    storageState: undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "api",
      testMatch: /.*\.api\.spec\.ts/,
      use: {
        baseURL: process.env.API_URL || "http://localhost:8989",
      },
    },
    {
      name: "deployment",
      testDir: "./tests/deployment",
      testMatch: /.*\.spec\.ts/,
      use: {
        baseURL: process.env.DEPLOY_WEB_URL || process.env.BASE_URL || "http://localhost:3939",
      },
    },
    {
      name: "live",
      testDir: "./tests/e2e/live",
      testMatch: /.*\.spec\.ts/,
      timeout: 180000,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: process.env.E2E_WEB_URL || process.env.BASE_URL || "http://localhost:3939",
        headless: false,
        video: "on",
        trace: "on",
      },
    },
    {
      name: "live-firefox",
      testDir: "./tests/e2e/live",
      testMatch: /golden-path-1\.spec\.ts/,
      timeout: 180000,
      use: {
        ...devices["Desktop Firefox"],
        baseURL: process.env.E2E_WEB_URL || process.env.BASE_URL || "http://localhost:3939",
        headless: false,
      },
    },
    {
      name: "live-safari",
      testDir: "./tests/e2e/live",
      testMatch: /golden-path-1\.spec\.ts/,
      timeout: 180000,
      use: {
        ...devices["Desktop Safari"],
        baseURL: process.env.E2E_WEB_URL || process.env.BASE_URL || "http://localhost:3939",
        headless: false,
      },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER ? undefined : [
    {
      command: "pnpm --filter @blanklogo/web dev",
      url: "http://localhost:3939",
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: "pnpm --filter @blanklogo/api dev",
      url: "http://localhost:8989/health",
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
