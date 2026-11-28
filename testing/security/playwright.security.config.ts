import { defineConfig, devices } from "@playwright/test";

// Section 4 role-based authorization checks.
// Separate from testing/e2e/playwright.config.ts so the two Section 3 E2E
// workflows are left untouched.
// CI sets E2E_BASE_URL=http://127.0.0.1:4000 (Linux resolves "localhost" to ::1).
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "./specs",
  testMatch: ["authorization.spec.ts", "session-controls.spec.ts"],
  outputDir: "./evidence/test-results",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "evidence/playwright-html", open: "never" }],
    ["json", { outputFile: "evidence/authorization-playwright-results.json" }],
    ...(process.env.GITHUB_ACTIONS ? ([["github"]] as const) : []),
  ],
  webServer: {
    command: "npm run local -- --host 127.0.0.1 --port 4000",
    cwd: "../../care_fe",
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120000,
    env: { REACT_CARE_API_URL: "http://127.0.0.1:9000" },
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
