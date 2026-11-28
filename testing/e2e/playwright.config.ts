import { defineConfig, devices } from "@playwright/test";

// CI sets E2E_BASE_URL=http://127.0.0.1:4000: on Linux runners Node resolves
// "localhost" to IPv6 ::1 first, while the Vite dev server listens on IPv4.
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4000";

export default defineConfig({
  testDir: "./specs",
  testMatch: ["encounter-e2e.spec.ts", "use-cases.spec.ts"],
  // Compiles the key screens once on a fresh dev server (see global-setup.ts).
  globalSetup: "./global-setup.ts",
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
    // In GitHub Actions, failures are also published as check annotations.
    ...(process.env.GITHUB_ACTIONS ? ([["github"]] as const) : []),
  ],
  webServer: {
    command:
      "npm run local -- --host 127.0.0.1 --port 4000",
    cwd: "../../care_fe",
    url: `${BASE_URL}/login`,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      REACT_CARE_API_URL: "http://127.0.0.1:9000",
    },
  },
  use: {
    baseURL: BASE_URL,
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
