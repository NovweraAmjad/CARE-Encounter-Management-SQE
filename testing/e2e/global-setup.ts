/**
 * Warm-up before the suite (Playwright globalSetup).
 *
 * In CI the Vite dev server is brand new, and it compiles each route's modules
 * the first time a page asks for them. On a GitHub runner that first compile of
 * the patient page took longer than the tests' 10 s assertion timeout, so only
 * the first test failed. This visits the pages used by the workflows once, with
 * generous timeouts, so the tests then run against a warm server. It changes no
 * assertion and creates no data beyond getFixture()'s fresh-database seeding.
 */
import { chromium, expect, type FullConfig } from "@playwright/test";

import { browserLogin, getFixture } from "./helpers";

const WARM_TIMEOUT = 180_000;

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL as string;
  const fixture = await getFixture();
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ baseURL })).newPage();
  try {
    const started = Date.now();
    await page.goto("/login", { timeout: WARM_TIMEOUT });
    await browserLogin(page);
    await page.goto(`/facility/${fixture.facilityId}/patient/${fixture.patientId}`, {
      waitUntil: "commit",
      timeout: WARM_TIMEOUT,
    });
    const patientHome = page.getByRole("link", { name: "Patient Home" }).first();
    await expect(patientHome).toBeVisible({ timeout: WARM_TIMEOUT });
    await patientHome.click();
    await expect(page.getByRole("button", { name: "Create Encounter" })).toBeVisible({
      timeout: WARM_TIMEOUT,
    });
    await page.goto(
      `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${fixture.encounterId}/updates`,
      { waitUntil: "commit", timeout: WARM_TIMEOUT },
    );
    await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible({
      timeout: WARM_TIMEOUT,
    });
    console.log(`[warm-up] key screens compiled and reachable in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  } finally {
    await browser.close();
  }
}
