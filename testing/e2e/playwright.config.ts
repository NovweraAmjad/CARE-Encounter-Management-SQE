import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  testMatch: ["encounter-e2e.spec.ts", "use-cases.spec.ts"],
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
  webServer: {
    command:
      "npm run local -- --host 127.0.0.1 --port 4000",
    cwd: "../../care_fe",
    url: "http://localhost:4000/login",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      REACT_CARE_API_URL: "http://127.0.0.1:9000",
    },
  },
  use: {
    baseURL: "http://localhost:4000",
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: process.env.ZAP_PROXY
      ? { proxy: { server: process.env.ZAP_PROXY } }
      : undefined,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
