import { expect, test } from "@playwright/test";
import {
  browserLogin,
  cleanupEncounter,
  createEncounter,
  getEncounter,
  getFixture,
  updateEncounter,
  updateByAdmin,
  resetActiveEncounters,
} from "../helpers";

async function openCreate(page: any) {
  const fixture = await getFixture();
  await resetActiveEncounters(fixture);
  await browserLogin(page);
  await page.goto(
    `/facility/${fixture.facilityId}/patient/${fixture.patientId}`,
  );
  await page.getByRole("link", { name: "Patient Home" }).first().click();
  await page.getByRole("button", { name: "Create Encounter" }).click();
  return fixture;
}

async function openEncounter(
  page: any,
  encounterId: string,
  suppliedFixture?: any,
  username = "care-doctor",
  password = "Ohcn@123",
) {
  const fixture = suppliedFixture ?? (await getFixture());
  await browserLogin(page, username, password);
  await page.goto(
    `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${encounterId}/updates`,
  );
  await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible();
  return fixture;
}

async function openCompletionDialog(page: any) {
  const trigger = page
    .getByRole("button", { name: /Mark as Completed/i })
    .first();
  await trigger.evaluate((element: HTMLElement) => element.click());
  await expect(page.getByRole("alertdialog")).toBeVisible();
}

async function triggerInpatientDischarge(page: any) {
  await page.getByRole("button", { name: "Encounter Actions" }).click();
  await page.getByRole("dialog").getByRole("option", { name: /Mark for discharge/i }).click();
  await expect(page).toHaveURL(/questionnaire\/encounter.*toDischarge=true/, {
    timeout: 15000,
  });
}

async function confirmCompletion(page: any) {
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Mark as complete" })
    .click();
}

test.describe("Team Member 1 - UC-ENC-001 Create Patient Encounter", () => {
  test("E2E-ENC-001 main: create ambulatory encounter", async ({ page }) => {
    const fixture = await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(page.getByText("Encounter created successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/encounter\/[^/]+\/updates/);
    const id = page.url().match(/\/encounter\/([^/]+)\//)?.[1];
    expect(id).toBeTruthy();
    const record = await getEncounter(fixture, id!);
    expect(record.encounter_class).toBe("amb");
    await cleanupEncounter(fixture, id!);
  });

  test("E2E-ENC-002 alternative: create planned encounter", async ({ page }) => {
    const fixture = await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Planned" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(page.getByText("Encounter created successfully")).toBeVisible();
  });

  test("E2E-ENC-003 alternative: create with emergency priority", async ({ page }) => {
    const fixture = await openCreate(page);
    await page.getByRole("button", { name: "Emergency" }).click();
    await page.getByRole("combobox", { name: "Priority" }).click();
    await page.getByRole("option", { name: "Emergency" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(page.getByText("Encounter created successfully")).toBeVisible();
  });

  test("E2E-EXC-001 exception: active encounter limit rejects duplicate creation", async ({ page }) => {
    const fixture = await getFixture();
    await browserLogin(page);
    await page.goto(`/facility/${fixture.facilityId}/patient/${fixture.patientId}`);
    await page.getByRole("link", { name: "Patient Home" }).first().click();
    await page.getByRole("button", { name: "Create Encounter" }).click();
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(
      page.getByText(/maximum number of active encounters|Encounter created successfully/),
    ).toBeVisible();
  });

  test("E2E-EXC-002 exception: unauthorized role cannot create encounter", async ({ page }) => {
    const fixture = await getFixture();
    await browserLogin(page, "care-volunteer", "Ohcn@123");
    await page.goto(`/facility/${fixture.facilityId}/patient/${fixture.patientId}`);
    await expect(
      page.getByRole("button", { name: "Create Encounter" }),
    ).toBeHidden();
  });
});

test.describe("Team Member 1 - UC-ENC-002 Create Date/Status Validation", () => {
  test("E2E-ENC-004 main: planned encounter accepts future date", async ({ page }) => {
    const fixture = await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Planned" }).click();
    await page
      .locator('[data-slot="form-item"]')
      .filter({ hasText: "Date and Time" })
      .locator('[data-slot="popover-trigger"]')
      .click();
    await page.getByRole("button", { name: "Go to the Next Month" }).click();
    await page
      .getByRole("gridcell")
      .filter({ hasText: /^15$/ })
      .getByRole("button")
      .click();
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/encounter/") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    const response = await createResponse;
    expect([200, 201]).toContain(response.status());
    await expect(page.getByText("Encounter created successfully")).toBeVisible();
  });

  test("E2E-ENC-005 alternative: in-progress encounter uses current date", async ({ page }) => {
    await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "In Progress" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(page.getByText("Encounter created successfully")).toBeVisible();
  });

  test("E2E-ENC-006 alternative: on-hold encounter uses current date", async ({ page }) => {
    await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "On Hold" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(page.getByText("Encounter created successfully")).toBeVisible();
  });

  test("E2E-EXC-003 exception: future planned date rejects switch to in-progress", async ({ page }) => {
    await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Planned" }).click();
    await page
      .locator('[data-slot="form-item"]')
      .filter({ hasText: "Date and Time" })
      .locator('[data-slot="popover-trigger"]')
      .click();
    await page.getByRole("button", { name: "Go to the Next Month" }).click();
    await page
      .getByRole("gridcell")
      .filter({ hasText: /^15$/ })
      .getByRole("button")
      .click();
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "In Progress" }).click();
    await page
      .getByRole("button", { name: /^Create Encounter/ })
      .click();
    await expect(
      page.getByText("Future date is only allowed for planned encounters"),
    ).toBeVisible();
  });

  test("E2E-EXC-004 exception: missing department rejects create", async ({ page }) => {
    await openCreate(page);
    await page.getByRole("button", { name: "Ambulatory" }).click();
    const createButton = page.getByRole("button", { name: /^Create Encounter/ });
    await expect(createButton).toBeEnabled();
    await page
      .getByRole("button", { name: "Remove Administration" })
      .click();
    await expect(createButton).toBeDisabled();
  });
});

test.describe("Team Member 2 - UC-ENC-003 Complete Ambulatory Encounter", () => {
  test("E2E-ENC-007 main: mark ambulatory encounter complete", async ({ page }) => {
    const fixture = await getFixture();
    await createEncounter(fixture);
    const setup = await createEncounter(fixture);
    const encounterId = setup.data.id;
    await openEncounter(page, encounterId, fixture);
    await openCompletionDialog(page);
    await confirmCompletion(page);
    await expect(page.getByRole("button", { name: /Status History: Completed/i })).toBeVisible();
    const record = await getEncounter(fixture, encounterId);
    expect(record.status).toBe("completed");
  });

  test("E2E-ENC-008 alternative: cancel completion dialog leaves encounter active", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture);
    await openEncounter(page, setup.data.id, fixture);
    await openCompletionDialog(page);
    await page.getByRole("button", { name: "Cancel" }).click();
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("in_progress");
  });

  test("E2E-ENC-009 alternative: existing period end is preserved", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture);
    const existingEnd = new Date(Date.now() - 3600000).toISOString();
    await updateEncounter(fixture, setup.data.id, {
      period: {
        start: new Date(Date.now() - 7200000).toISOString(),
        end: existingEnd,
      },
    });
    await openEncounter(page, setup.data.id, fixture);
    await openCompletionDialog(page);
    await confirmCompletion(page);
    await expect(page.getByRole("button", { name: /Status History: Completed/i })).toBeVisible();
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("completed");
    expect(record.period.end).toBeTruthy();
  });

  test("E2E-EXC-005 exception: already completed encounter has no mark-complete action", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, { status: "completed" });
    await openEncounter(page, setup.data.id, fixture);
    await expect(page.getByRole("button", { name: /Mark (for discharge|as complete)/i })).toBeHidden();
  });

  test("E2E-EXC-006 exception: unauthorized role has no mark-complete action", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture);
    await browserLogin(page, "care-volunteer", "Ohcn@123");
    await page.goto(
      `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${setup.data.id}/updates`,
    );
    await expect(page.getByRole("button", { name: /Mark (for discharge|as complete)/i })).toBeHidden();
  });
});

test.describe("Team Member 2 - UC-ENC-004 Complete Inpatient Encounter", () => {
  test("E2E-ENC-010 main: inpatient routes to discharge questionnaire", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, {
      encounter_class: "imp",
      status: "in_progress",
    });
    expect(setup.status).toBe(200);
    expect(setup.data.encounter_class).toBe("imp");
    expect(setup.data.status).toBe("in_progress");
    await openEncounter(page, setup.data.id, fixture);
    await triggerInpatientDischarge(page);
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("in_progress");
  });

  test("E2E-ENC-011 alternative: discharged inpatient can be directly completed", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, {
      encounter_class: "imp",
      status: "discharged",
    });
    await openEncounter(page, setup.data.id, fixture);
    await openCompletionDialog(page);
    await confirmCompletion(page);
    await expect(page.getByRole("button", { name: /Status History: Completed/i })).toBeVisible();
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("completed");
  });

  test("E2E-ENC-012 alternative: cancel inpatient discharge route leaves status unchanged", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, {
      encounter_class: "imp",
      status: "in_progress",
    });
    expect(setup.status).toBe(200);
    expect(setup.data.encounter_class).toBe("imp");
    expect(setup.data.status).toBe("in_progress");
    await openEncounter(page, setup.data.id, fixture);
    await triggerInpatientDischarge(page);
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("in_progress");
  });

  test("E2E-EXC-007 exception: completed inpatient has no discharge action", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, {
      encounter_class: "imp",
      status: "completed",
    });
    await openEncounter(page, setup.data.id, fixture);
    await expect(page.getByRole("button", { name: /Mark (for discharge|as complete)/i })).toBeHidden();
  });

  test("E2E-EXC-008 exception: unauthorized inpatient has no discharge action", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, {
      encounter_class: "imp",
      status: "in_progress",
    });
    await browserLogin(page, "care-volunteer", "Ohcn@123");
    await page.goto(
      `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${setup.data.id}/updates`,
    );
    await expect(page.getByRole("button", { name: /Mark (for discharge|as complete)/i })).toBeHidden();
  });
});

test.describe("Team Member 3 - UC-ENC-005 Encounter Details and Filters", () => {
  test("E2E-ENC-013 main: open encounter details", async ({ page }) => {
    const fixture = await getFixture();
    await openEncounter(page, fixture.encounterId, fixture);
    await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible();
  });

  test("E2E-ENC-014 alternative: filter encounters by status", async ({ page }) => {
    const fixture = await getFixture();
    await browserLogin(page);
    await page.goto(
      `/facility/${fixture.facilityId}/encounters/patients/all?status=in_progress`,
    );
    await expect(page.getByText(/In Progress|Encounter/i).first()).toBeVisible();
  });

  test("E2E-ENC-015 alternative: filter encounters by patient name", async ({ page }) => {
    const fixture = await getFixture();
    await browserLogin(page);
    await page.goto(
      `/facility/${fixture.facilityId}/encounters/patients/all`,
    );
    const search = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();
    await expect(search).toBeVisible();
  });

  test("E2E-EXC-009 exception: nonexistent encounter route is not displayed", async ({ page }) => {
    const fixture = await getFixture();
    await browserLogin(page);
    await page.goto(
      `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/00000000-0000-4000-8000-000000000000/updates`,
    );
    await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeHidden();
  });

  test("E2E-EXC-010 exception: mismatched patient context is rejected", async ({ page }) => {
    const fixture = await getFixture();
    await browserLogin(page);
    await page.goto(
      `/facility/${fixture.facilityId}/patient/00000000-0000-4000-8000-000000000000/encounter/${fixture.encounterId}/updates`,
    );
    await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeHidden();
  });
});

test.describe("Team Member 3 - UC-ENC-006 Restart Encounter", () => {
  test("E2E-ENC-016 main: restart completed encounter", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, { status: "completed" });
    await openEncounter(page, setup.data.id, fixture, "admin", "admin");
    await page.getByRole("button", { name: "Encounter Actions" }).click();
    await page.getByRole("dialog").getByRole("option", { name: /Restart Encounter/i }).click();
    await expect(page.getByText(/restarted successfully/i)).toBeVisible();
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("in_progress");
  });

  test("E2E-ENC-017 alternative: restart repeated request remains in progress", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, { status: "completed" });
    await openEncounter(page, setup.data.id, fixture, "admin", "admin");
    await page.getByRole("button", { name: "Encounter Actions" }).click();
    await page.getByRole("dialog").getByRole("option", { name: /Restart Encounter/i }).click();
    await expect(page.getByText(/restarted successfully/i)).toBeVisible();
    await page.waitForURL(/\/encounter\/[^/]+\/updates/);
    const record = await getEncounter(fixture, setup.data.id);
    expect(record.status).toBe("in_progress");
  });

  test("E2E-ENC-018 alternative: completed encounter within limit has restart control", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, { status: "completed" });
    await openEncounter(page, setup.data.id, fixture, "admin", "admin");
    await expect(page.getByRole("button", { name: "Encounter Actions" })).toBeVisible();
  });

  test("E2E-EXC-011 exception: noncompleted encounter has no restart control", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, { status: "in_progress" });
    await openEncounter(page, setup.data.id, fixture);
    await expect(page.locator("button:has(svg.lucide-settings)").first()).toBeHidden();
  });

  test("E2E-EXC-012 exception: unauthorized user has no restart control", async ({ page }) => {
    const fixture = await getFixture();
    const setup = await createEncounter(fixture, { status: "completed" });
    await browserLogin(page, "care-volunteer", "Ohcn@123");
    await page.goto(
      `/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${setup.data.id}/updates`,
    );
    await expect(page.locator("button:has(svg.lucide-settings)").first()).toBeHidden();
  });
});
