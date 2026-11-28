import type { Page } from "@playwright/test";

const API = "http://127.0.0.1:9000";

export interface Fixture {
  access: string;
  facilityId: string;
  patientId: string;
  encounterId: string;
  organizationId: string;
  phoneNumber: string;
  yearOfBirth: string;
}

export async function apiLogin(username = "care-doctor", password = "Ohcn@123") {
  const response = await fetch(`${API}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  const data = await response.json();
  return data.access as string;
}

export async function apiGet(access: string, path: string) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GET ${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

export async function apiPost(access: string, path: string, body: unknown) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: response.status, data };
}

export async function apiPut(access: string, path: string, body: unknown) {
  const response = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { status: response.status, data };
}

export async function getFixture(): Promise<Fixture> {
  const access = await apiLogin();
  const facilities = await apiGet(access, "/api/v1/facility/");
  const facilityId = facilities.results[0].id;
  const organizations = await apiGet(
    access,
    `/api/v1/facility/${facilityId}/organizations/`,
  );
  const organizationId =
    organizations.results.find((org: any) => org.org_type !== "root")?.id ??
    organizations.results[0].id;
  let encounterList = await apiGet(
    access,
    `/api/v1/encounter/?facility=${facilityId}`,
  );
  if (!encounterList.results.length) {
    // Fresh database (e.g. CI): the fixture encounters belong to a department
    // care-doctor is not in, so none are visible. Seed one in the doctor's
    // department for the fixture patient whose id CI exports.
    const seedPatient = process.env.E2E_PATIENT_ID;
    if (!seedPatient) {
      throw new Error(
        "No encounter visible to care-doctor. Set E2E_PATIENT_ID to a fixture patient id.",
      );
    }
    const seeded = await apiPost(access, "/api/v1/encounter/", {
      patient: seedPatient,
      facility: facilityId,
      status: "in_progress",
      encounter_class: "amb",
      priority: "routine",
      organizations: [organizationId],
      period: { start: new Date().toISOString() },
    });
    if (![200, 201].includes(seeded.status)) {
      throw new Error(`Seeding encounter failed: ${seeded.status} ${JSON.stringify(seeded.data).slice(0, 200)}`);
    }
    encounterList = await apiGet(access, `/api/v1/encounter/?facility=${facilityId}`);
  }
  const encounter = encounterList.results[0];
  const patientId = encounter.patient.id;
  return {
    access,
    facilityId,
    patientId,
    encounterId: encounter.id,
    organizationId,
    phoneNumber: encounter.patient.phone_number ?? "",
    yearOfBirth: encounter.patient.year_of_birth?.toString() ?? "",
  };
}

export async function browserLogin(page: Page, username = "care-doctor", password = "Ohcn@123") {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
}

export async function createEncounter(
  fixture: Fixture,
  overrides: Record<string, unknown> = {},
) {
  await resetActiveEncounters(fixture);
  const payload: Record<string, unknown> = {
    patient: fixture.patientId,
    facility: fixture.facilityId,
    status: "in_progress",
    encounter_class: "amb",
    priority: "routine",
    organizations: [fixture.organizationId],
    period: { start: new Date().toISOString() },
    ...overrides,
  };
  return apiPost(fixture.access, "/api/v1/encounter/", payload);
}

export async function createActiveEncounterDirect(
  fixture: Fixture,
) {
  const payload: Record<string, unknown> = {
    patient: fixture.patientId,
    facility: fixture.facilityId,
    status: "in_progress",
    encounter_class: "amb",
    priority: "routine",
    organizations: [fixture.organizationId],
    period: { start: new Date().toISOString() },
  };
  return apiPost(fixture.access, "/api/v1/encounter/", payload);
}

export async function getEncounter(fixture: Fixture, encounterId: string) {
  return apiGet(
    fixture.access,
    `/api/v1/encounter/${encounterId}/?facility=${fixture.facilityId}&patient=${fixture.patientId}`,
  );
}

export async function updateEncounter(
  fixture: Fixture,
  encounterId: string,
  changes: Record<string, unknown>,
) {
  const existing = await getEncounter(fixture, encounterId);
  const payload = {
    status: existing.status,
    period: existing.period,
    hospitalization: existing.hospitalization,
    priority: existing.priority,
    external_identifier: existing.external_identifier,
    discharge_summary_advice: existing.discharge_summary_advice,
    ...changes,
  };
  return apiPut(
    fixture.access,
    `/api/v1/encounter/${encounterId}/`,
    payload,
  );
}

export async function updateByAdmin(fixture: Fixture, encounterId: string, changes: Record<string, unknown>) {
  const adminAccess = await apiLogin("admin", "admin");
  const adminFixture = { ...fixture, access: adminAccess };
  return updateEncounter(adminFixture, encounterId, changes);
}

export async function cleanupEncounter(fixture: Fixture, encounterId: string) {
  await updateEncounter(fixture, encounterId, { status: "cancelled" });
}

export async function resetActiveEncounters(fixture: Fixture) {
  const access = fixture.access;
  const list = await apiGet(
    access,
    `/api/v1/encounter/?facility=${fixture.facilityId}`,
  );
  let kept = false;
  for (const encounter of list.results ?? []) {
    if (encounter.patient?.id !== fixture.patientId) continue;
    if (!["completed", "cancelled", "entered_in_error", "discontinued"].includes(encounter.status)) {
      if (!kept) {
        kept = true;
        continue;
      }
      await updateEncounter(fixture, encounter.id, { status: "cancelled" });
    }
  }
}
