/**
 * Checks how the Create Encounter "Date and Time" field exposes its name and its
 * business-rule error (BR-ENC-02) to assistive technology.
 *
 * Usage (from testing/e2e): node verify-error-association.js <before|after>
 * Output: testing/accessibility/<phase>/error-association.json
 *
 * Nothing is created: the future date is rejected in the browser before any request.
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const PHASE = process.argv[2] ?? "after";
const API = "http://127.0.0.1:9000";
const FRONTEND = "http://localhost:4000";
const PASSWORD = process.env.CARE_FIXTURE_PASSWORD ?? "Ohcn@123";

(async () => {
  const login = await fetch(`${API}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "care-doctor", password: PASSWORD }),
  });
  const headers = { Authorization: `Bearer ${(await login.json()).access}` };
  const facilityId = (await (await fetch(`${API}/api/v1/facility/`, { headers })).json()).results[0].id;
  const encounter = (await (await fetch(`${API}/api/v1/encounter/?facility=${facilityId}`, { headers })).json()).results[0];

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: FRONTEND });
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/api/v1/encounter")) posts.push(r.url());
  });
  try {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Username" }).fill("care-doctor");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/^(?!.*\/login).*$/);
    await page.goto(`/facility/${facilityId}/patient/${encounter.patient.id}`, { waitUntil: "commit" });
    await page.getByRole("link", { name: "Patient Home" }).first().click();
    await page.getByRole("button", { name: "Create Encounter" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^Create Encounter/ })).toBeEnabled();

    const time = dialog.locator('input[type="time"]');
    const describe = () =>
      time.evaluate((el) => {
        const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
        return {
          id: el.id || null,
          labelledBy: el.labels?.[0]?.innerText ?? null,
          ariaInvalid: el.getAttribute("aria-invalid"),
          describedByText: ids.map((id) => document.getElementById(id)?.innerText).filter(Boolean),
        };
      });
    const initial = await describe();
    const accessibleName = await time.evaluate((el) => el.labels?.[0]?.innerText ?? el.getAttribute("aria-label") ?? "");

    // Tomorrow + In Progress -> rejected by BR-ENC-02 (keyboard only).
    const date = dialog.getByRole("button", { name: /^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th), \d{4}$/ });
    await date.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("grid")).toBeVisible();
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=grid]"))).toBe(true);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: /^Ambulatory/ }).focus();
    await page.keyboard.press("Enter");
    const status = dialog.getByRole("combobox", { name: "Status" });
    await status.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: "In Progress" })).toBeVisible();
    for (let i = 0; i < 4; i += 1) {
      if ((await page.evaluate(() => document.activeElement?.innerText?.trim())) === "In Progress") break;
      await page.keyboard.press("ArrowUp");
    }
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: /^Create Encounter/ }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByText("Future date is only allowed for planned encounters")).toBeVisible();
    const afterError = await describe();

    const result = {
      phase: PHASE,
      generated: new Date().toISOString(),
      field: "Create Encounter > Date and Time > time input",
      accessible_name: accessibleName || null,
      before_submit: initial,
      after_rejected_submit: afterError,
      error_announced_with_field:
        afterError.ariaInvalid === "true" &&
        afterError.describedByText.some((t) => /Future date is only allowed/.test(t)),
      create_requests_sent: posts.length,
    };
    const out = path.resolve(__dirname, "..", "accessibility", PHASE, "error-association.json");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
  }
})();
