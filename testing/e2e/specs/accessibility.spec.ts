import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { browserLogin, createEncounter, getFixture } from "../helpers";

async function saveAxe(name: string, results: any) {
  const dir = path.resolve(process.cwd(), "reports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${name}.json`),
    JSON.stringify(results, null, 2),
  );
}

test("AXE-ENC-001 encounter creation accessibility", async ({ page }) => {
  const fixture = await getFixture();
  await browserLogin(page);
  await page.goto(`/facility/${fixture.facilityId}/patient/${fixture.patientId}`);
  await page.getByRole("link", { name: "Patient Home" }).first().click();
  await page.getByRole("button", { name: "Create Encounter" }).click();
  const results = await new AxeBuilder({ page }).analyze();
  await saveAxe("axe-create", results);
  await page.screenshot({ path: "screenshots/axe-create.png", fullPage: true });
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("AXE-ENC-002 encounter details accessibility", async ({ page }) => {
  const fixture = await getFixture();
  await browserLogin(page);
  await page.goto(
    `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${fixture.encounterId}/updates`,
  );
  await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  await saveAxe("axe-details", results);
  await page.screenshot({ path: "screenshots/axe-details.png", fullPage: true });
});

test("AXE-ENC-003 encounter progress accessibility", async ({ page }) => {
  const fixture = await getFixture();
  const setup = await createEncounter(fixture, {
    encounter_class: "amb",
    status: "in_progress",
  });
  await browserLogin(page);
  await page.goto(
    `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${setup.data.id}/updates`,
  );
  await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  await saveAxe("axe-progress", results);
  await page.screenshot({ path: "screenshots/axe-progress.png", fullPage: true });
});
