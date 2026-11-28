// Runs the two UNCHANGED Section 3 workflows (testing/e2e/specs/encounter-e2e.spec.ts)
// through the OWASP ZAP proxy for passive scanning.
//
// Run from testing/e2e so the spec and this config share one Playwright install:
//   cd testing/e2e
//   npx playwright test --config=../security/playwright.zap.config.ts
//
// Intentionally has no imports: importing @playwright/test here would load a
// second Playwright copy (testing/security/node_modules) next to the spec's copy.
const ZAP_PROXY = process.env.ZAP_PROXY ?? "http://127.0.0.1:8090";

export default {
  testDir: "../e2e/specs",
  testMatch: "encounter-e2e.spec.ts",
  outputDir: "./zap/reports/playwright-test-results",
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "zap/reports/playwright-workflows-results.json" }],
  ],
  webServer: {
    command: "npm run local -- --host 127.0.0.1 --port 4000",
    cwd: "../../care_fe",
    url: "http://localhost:4000/login",
    reuseExistingServer: true,
    timeout: 120000,
    env: { REACT_CARE_API_URL: "http://127.0.0.1:9000" },
  },
  use: {
    baseURL: "http://localhost:4000",
    headless: true,
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      proxy: { server: ZAP_PROXY },
      // Chromium bypasses proxies for localhost by default; "<-loopback>" removes
      // that implicit rule so ZAP sees the frontend and API traffic.
      args: ["--proxy-bypass-list=<-loopback>"],
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
};
