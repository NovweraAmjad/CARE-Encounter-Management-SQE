import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  outputDir: "./test-results",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/playwright-html", open: "never" }],
    ["json", { outputFile: "reports/results.json" }],
  ],
  use: {
    baseURL: "http://localhost:4000",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
