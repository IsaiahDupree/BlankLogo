import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60000,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3838",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
  ],
  webServer: process.env.SKIP_WEBSERVER ? undefined : [
    {
      command: "pnpm --filter @blanklogo/web dev",
      url: "http://localhost:3838",
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
