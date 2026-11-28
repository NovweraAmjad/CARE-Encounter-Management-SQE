/**
 * Use-case tests (browser E2E) for the two CARE encounter use cases.
 *
 *  UC1 Create Patient Encounter   (docs/workflow-specification.md, Workflow 1)
 *  UC2 Complete Patient Encounter (docs/workflow-specification.md, Workflow 2)
 *
 * The MAIN flow of each use case is in encounter-e2e.spec.ts. This file automates
 * the alternative (ALT) and exception (EXC) flows. Each test asserts what the
 * user sees AND the postcondition read back from the API.
 *
 * The synthetic patient visible to care-doctor is used. Tests run serially
 * (workers: 1) and each test first cancels that patient's open encounters, so
 * tests do not depend on each other's leftovers.
 */
import { expect, test, type Page } from "@playwright/test";

import { apiGet, apiPost, apiPut, browserLogin, getFixture } from "../helpers";

const OPEN = ["planned", "in_progress", "on_hold"];

interface Ctx {
  access: string;
  facilityId: string;
  organizationId: string;
  patientId: string;
}
let ctx: Ctx;

test.beforeAll(async () => {
  // Same synthetic patient as encounter-e2e.spec.ts: visible to care-doctor
  // through the doctor's department (getFixture seeds it on a fresh database).
  const { access, facilityId, organizationId, patientId } = await getFixture();
  ctx = { access, facilityId, organizationId, patientId };
});

// ------------------------------------------------------------------ helpers

async function encountersOf(patientId: string) {
  const list = await apiGet(
    ctx.access,
    `/api/v1/encounter/?facility=${ctx.facilityId}&patient_filter=${patientId}&limit=100`,
  );
  return list.results as any[];
}

async function activeCount(patientId: string) {
  return (await encountersOf(patientId)).filter((e) => OPEN.includes(e.status)).length;
}

async function readEncounter(id: string) {
  return apiGet(ctx.access, `/api/v1/encounter/${id}/`);
}

async function setStatus(e: any, status: string) {
  return apiPut(ctx.access, `/api/v1/encounter/${e.id}/`, {
    status,
    period: e.period,
    hospitalization: e.hospitalization ?? {},
    priority: e.priority,
    external_identifier: e.external_identifier,
    discharge_summary_advice: e.discharge_summary_advice,
  });
}

/** Cancel every open encounter of the patient (synthetic data reset). */
async function clearOpen(patientId: string) {
  for (const e of await encountersOf(patientId)) {
    if (OPEN.includes(e.status)) {
      const full = await readEncounter(e.id);
      const res = await setStatus(full, "cancelled");
      expect([200, 202]).toContain(res.status);
    }
  }
  expect(await activeCount(patientId)).toBe(0);
}

async function createViaApi(patientId: string, overrides: Record<string, unknown> = {}) {
  const res = await apiPost(ctx.access, "/api/v1/encounter/", {
    patient: patientId,
    facility: ctx.facilityId,
    status: "in_progress",
    encounter_class: "amb",
    priority: "routine",
    organizations: [ctx.organizationId],
    period: { start: new Date().toISOString() },
    ...overrides,
  });
  expect([200, 201], JSON.stringify(res.data).slice(0, 200)).toContain(res.status);
  return res.data;
}

/**
 * CARE grants a doctor access to a patient THROUGH an open encounter in the
 * doctor's department (find_roles_on_patient ignores completed/cancelled ones).
 * Create-flow tests therefore reset to exactly one open "anchor" encounter, so
 * the patient page is reachable on any database, including a fresh CI one.
 */
async function resetWithAnchor(patientId: string) {
  await clearOpen(patientId);
  await createViaApi(patientId);
  expect(await activeCount(patientId)).toBe(1);
}

async function openCreateDialog(page: Page, patientId: string) {
  await browserLogin(page);
  await page.goto(`/facility/${ctx.facilityId}/patient/${patientId}`, { waitUntil: "commit" });
  await page.getByRole("link", { name: "Patient Home" }).first().click();
  await page.getByRole("button", { name: "Create Encounter" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole("button", { name: /^Create Encounter/ });
  await expect(submit).toBeEnabled(); // enabled once the default department loads
  return { dialog, submit };
}

function trackEncounterWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (r) => {
    const p = new URL(r.url()).pathname;
    if (
      (r.method() === "POST" && /\/api\/v1\/encounter\/?$/.test(p)) ||
      (r.method() === "PUT" && /\/api\/v1\/encounter\/[^/]+\/$/.test(p)) ||
      (r.method() === "POST" && p.includes("/batch_requests"))
    ) {
      writes.push(`${r.method()} ${p}`);
    }
  });
  return writes;
}

async function openEncounter(page: Page, patientId: string, encounterId: string, user?: string) {
  if (user) await browserLogin(page, user);
  else await browserLogin(page);
  await page.goto(
    `/facility/${ctx.facilityId}/patient/${patientId}/encounter/${encounterId}/updates`,
    { waitUntil: "commit" },
  );
}

async function openActionsPanel(page: Page) {
  await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Actions", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Actions" });
  await expect(panel).toBeVisible();
  return panel;
}

// ============================================================== UC1 – Create

test.describe("UC1 Create Patient Encounter", () => {
  test("UC1-ALT-1 planned encounter with a future start date is accepted", async ({ page }) => {
    const patientId = ctx.patientId;
    await resetWithAnchor(patientId);
    const { dialog, submit } = await openCreateDialog(page, patientId);

    // Status defaults to Planned; a future start is allowed for Planned (BR-ENC-02).
    await expect(dialog.getByRole("combobox", { name: "Status" })).toHaveText(/Planned/);
    const dateButton = dialog.getByRole("button", { name: /^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th), \d{4}$/ });
    await dateButton.click();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=grid]")))
      .toBe(true);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: /^Ambulatory/ }).click();
    await submit.click();

    await expect(page.getByText("Encounter created successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/encounter\/[^/]+\/updates/);
    const id = page.url().match(/\/encounter\/([^/]+)\//)![1];
    const stored = await readEncounter(id);
    expect(stored.status).toBe("planned");
    expect(new Date(stored.period.start).getTime()).toBeGreaterThan(Date.now());
  });

  test("UC1-ALT-2 emergency encounter with urgent priority is created", async ({ page }) => {
    const patientId = ctx.patientId;
    await resetWithAnchor(patientId);
    const { dialog, submit } = await openCreateDialog(page, patientId);

    await dialog.getByRole("button", { name: /^Emergency/ }).click();
    await dialog.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "In Progress" }).click();
    await dialog.getByRole("combobox", { name: "Priority" }).click();
    await page.getByRole("option", { name: "Urgent", exact: true }).click();
    await expect(dialog.getByRole("combobox", { name: "Priority" })).toHaveText(/Urgent/);
    await submit.click();

    await expect(page.getByText("Encounter created successfully")).toBeVisible();
    await expect(page).toHaveURL(/\/encounter\/[^/]+\/updates/);
    const id = page.url().match(/\/encounter\/([^/]+)\//)![1];
    const stored = await readEncounter(id);
    expect(stored.encounter_class).toBe("emer");
    expect(stored.priority).toBe("urgent");
    expect(stored.status).toBe("in_progress");
    expect(stored.status_history?.history?.[0]?.status ?? stored.status_history?.[0]?.status).toBe("in_progress");
  });

  test("UC1-EXC-1 submitting without an encounter type is blocked", async ({ page }) => {
    const patientId = ctx.patientId;
    await resetWithAnchor(patientId);
    const before = (await encountersOf(patientId)).length;
    const writes = trackEncounterWrites(page);
    const { dialog, submit } = await openCreateDialog(page, patientId);

    await submit.click();

    const typeSection = dialog.locator("div").filter({ has: page.getByText("Type of Encounter", { exact: true }) }).last();
    await expect(dialog.getByText("Required", { exact: true })).toBeVisible();
    await expect(typeSection).toBeVisible();
    await expect(dialog).toBeVisible(); // stays open for correction
    expect(writes).toHaveLength(0);
    expect((await encountersOf(patientId)).length).toBe(before);
  });

  test("UC1-EXC-2 creation is rejected at the active-encounter limit", async ({ page }) => {
    const patientId = ctx.patientId;
    await clearOpen(patientId);
    const created: any[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await apiPost(ctx.access, "/api/v1/encounter/", {
        patient: patientId, facility: ctx.facilityId, status: "in_progress",
        encounter_class: "amb", priority: "routine", organizations: [ctx.organizationId],
        period: { start: new Date().toISOString() },
      });
      if (res.status === 400) break;
      created.push(res.data);
    }
    const limit = await activeCount(patientId);
    expect(limit).toBeGreaterThan(0);

    const { dialog, submit } = await openCreateDialog(page, patientId);
    await dialog.getByRole("button", { name: /^Ambulatory/ }).click();
    await submit.click();

    await expect(page.getByText(/maximum number of active encounters \(\d+\)/i)).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await activeCount(patientId)).toBe(limit); // nothing persisted

    for (const e of created) await setStatus(await readEncounter(e.id), "cancelled");
  });
});

// ============================================================ UC2 – Complete

test.describe("UC2 Complete Patient Encounter", () => {
  test("UC2-ALT-1 inpatient encounter is routed to the discharge questionnaire", async ({ page }) => {
    const patientId = ctx.patientId;
    await clearOpen(patientId);
    const enc = await createViaApi(patientId, { encounter_class: "imp" });
    const writes = trackEncounterWrites(page);

    await openEncounter(page, patientId, enc.id);
    const panel = await openActionsPanel(page);
    await expect(panel.getByRole("button", { name: /Mark as Completed/i })).toHaveCount(0);
    await panel.getByRole("button", { name: /Mark for discharge/i }).click();
    const confirm = page.getByRole("alertdialog");
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.getByRole("button", { name: "Mark as complete" }).click();
    }

    await expect(page).toHaveURL(new RegExp(`/encounter/${enc.id}/questionnaire/encounter\\?toDischarge=true`));
    expect(writes).toHaveLength(0); // no completion request before discharge
    expect((await readEncounter(enc.id)).status).toBe("in_progress");
    await setStatus(await readEncounter(enc.id), "cancelled");
  });

  test("UC2-ALT-2 completing an encounter that already has an end time keeps that end", async ({ page }) => {
    const patientId = ctx.patientId;
    await clearOpen(patientId);
    const start = new Date(Date.now() - 3 * 3600_000).toISOString();
    const end = new Date(Date.now() - 1 * 3600_000).toISOString();
    const enc = await createViaApi(patientId, { period: { start, end } });

    await openEncounter(page, patientId, enc.id);
    const panel = await openActionsPanel(page);
    await panel.getByRole("button", { name: /Mark as Completed/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Mark as complete" }).click();

    await expect(page.getByText("Encounter Completed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Status History: Completed/i })).toBeVisible();
    const stored = await readEncounter(enc.id);
    expect(stored.status).toBe("completed");
    expect(new Date(stored.period.start).getTime()).toBe(new Date(start).getTime());
    expect(new Date(stored.period.end).getTime()).toBe(new Date(end).getTime());
  });

  test("UC2-EXC-1 cancelling the confirmation leaves the encounter open", async ({ page }) => {
    const patientId = ctx.patientId;
    await clearOpen(patientId);
    const enc = await createViaApi(patientId);
    const writes = trackEncounterWrites(page);

    await openEncounter(page, patientId, enc.id);
    const panel = await openActionsPanel(page);
    await panel.getByRole("button", { name: /Mark as Completed/i }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();

    await expect(confirm).toBeHidden();
    await expect(page.getByRole("button", { name: /Status History: In Progress/i })).toBeVisible();
    await expect(page.getByText("Encounter Completed", { exact: true })).toHaveCount(0);
    expect(writes).toHaveLength(0);
    expect((await readEncounter(enc.id)).status).toBe("in_progress");
    await setStatus(await readEncounter(enc.id), "cancelled");
  });

  test("UC2-EXC-2 a user without encounter permission cannot complete it", async ({ page }) => {
    const patientId = ctx.patientId;
    await clearOpen(patientId);
    const enc = await createViaApi(patientId);
    const writes = trackEncounterWrites(page);

    await openEncounter(page, patientId, enc.id, "care-volunteer");

    await expect(page.getByText("You do not have permission to view this encounter")).toBeVisible();
    await expect(page.getByRole("region", { name: "Encounter", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Mark as Completed/i }).filter({ visible: true })).toHaveCount(0);
    expect(writes).toHaveLength(0);
    expect((await readEncounter(enc.id)).status).toBe("in_progress");
    await setStatus(await readEncounter(enc.id), "cancelled");
  });
});
