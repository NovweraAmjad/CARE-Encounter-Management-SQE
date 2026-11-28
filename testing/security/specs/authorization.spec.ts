/**
 * Section 4 - Role-based access checks for the CARE encounter workflows.
 *
 * Roles (from care/care/fixtures/scripts/default_fixtures.py, synthetic local accounts):
 *   care-doctor    -> "Doctor" role, member of the facility "Administration" organization
 *   care-volunteer -> "Volunteer" role in the "Volunteer" role organization, no facility membership
 *
 * Expected decisions come from care/care/security/permissions/encounter.py:
 *   can_create/list/read/write_encounter = [Admin, Doctor, Nurse, Facility Admin]  (no Volunteer)
 *
 * Every check writes {id, role, action, request, expected, observed, status, evidence}
 * to evidence/authorization-results.json and evidence/authorization-results.md.
 * Non-destructive: denied requests change nothing; the single allowed write is a
 * no-op PUT that re-sends the encounter's current values.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const API = "http://127.0.0.1:9000";
// Synthetic fixture password printed by CARE's load_fixtures command (local only).
const FIXTURE_PASSWORD = process.env.CARE_FIXTURE_PASSWORD ?? "Ohcn@123";
const OPEN_STATUSES = ["planned", "in_progress", "on_hold"];
const EVIDENCE_DIR = path.resolve(__dirname, "..", "evidence");
const SHOT_DIR = path.join(EVIDENCE_DIR, "screenshots");

type Decision = "Allowed" | "Denied";
interface CheckRecord {
  id: string;
  role: string;
  action: string;
  request: string;
  expected: Decision;
  observed: Decision;
  http_status: number | string;
  result: "PASS" | "FAIL";
  evidence: string;
}
const records: CheckRecord[] = [];

function record(r: Omit<CheckRecord, "result">) {
  records.push({ ...r, result: r.expected === r.observed ? "PASS" : "FAIL" });
}

async function login(request: APIRequestContext, username: string) {
  const res = await request.post(`${API}/api/v1/auth/login/`, {
    data: { username, password: FIXTURE_PASSWORD },
  });
  expect(res.status(), `login for ${username}`).toBe(200);
  return (await res.json()).access as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

interface Ctx {
  doctor: string;
  volunteer: string;
  facilityId: string;
  encounter: any; // an open (not completed) encounter visible to the doctor
  organizationId: string;
  roleEvidence: Record<string, unknown>;
}
let ctx: Ctx;

test.beforeAll(async ({ request }) => {
  const doctor = await login(request, "care-doctor");
  const volunteer = await login(request, "care-volunteer");

  const facilities = await (
    await request.get(`${API}/api/v1/facility/`, { headers: auth(doctor) })
  ).json();
  const facilityId = facilities.results[0].id;

  // Prefer an open encounter so a volunteer 403 reflects the role check, not the
  // "closed encounter cannot be written" rule in can_update_encounter_obj().
  const getList = async (query: string) =>
    (
      await request.get(`${API}/api/v1/encounter/?facility=${facilityId}${query}`, {
        headers: auth(doctor),
      })
    ).json();
  const orgs = await (
    await request.get(`${API}/api/v1/facility/${facilityId}/organizations/`, {
      headers: auth(doctor),
    })
  ).json();
  const organizationId =
    orgs.results.find((o: any) => o.org_type !== "root")?.id ?? orgs.results[0].id;

  let encounter = (await getList(`&status=${OPEN_STATUSES.join(",")}`)).results?.[0];
  if (!encounter) {
    // No open encounter left (e.g. after the E2E suite in CI): create one as the
    // doctor (an allowed action), so the checks never run against a closed one.
    const anyEncounter = (await getList("")).results[0];
    const seeded = await request.post(`${API}/api/v1/encounter/`, {
      headers: auth(doctor),
      data: {
        patient: anyEncounter.patient.id,
        facility: facilityId,
        status: "in_progress",
        encounter_class: "amb",
        priority: "routine",
        organizations: [organizationId],
        period: { start: new Date().toISOString() },
      },
    });
    expect([200, 201], "seed an open encounter").toContain(seeded.status());
    encounter = await (
      await request.get(`${API}/api/v1/encounter/${(await seeded.json()).id}/`, {
        headers: auth(doctor),
      })
    ).json();
  }

  // Record the server's own view of each account so the role is evidenced, not assumed.
  const roleEvidence: Record<string, unknown> = {};
  for (const [name, token] of [
    ["care-doctor", doctor],
    ["care-volunteer", volunteer],
  ] as const) {
    const me = await (
      await request.get(`${API}/api/v1/users/getcurrentuser/`, { headers: auth(token) })
    ).json();
    roleEvidence[name] = {
      is_superuser: me.is_superuser,
      role_organizations: (me.organizations ?? []).map((o: any) => o.name),
      facilities: (me.facilities ?? []).map((f: any) => f.name),
    };
  }

  ctx = { doctor, volunteer, facilityId, encounter, organizationId, roleEvidence };
});

test.afterAll(async () => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "authorization-results.json"),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        backend: API,
        frontend: "http://localhost:4000",
        role_evidence: ctx?.roleEvidence,
        checks: records,
      },
      null,
      2,
    ),
  );
  const rows = records
    .map(
      (r) =>
        `| ${r.id} | ${r.role} | ${r.action} | \`${r.request}\` | ${r.expected} | ${r.observed} (${r.http_status}) | ${r.result} | ${r.evidence} |`,
    )
    .join("\n");
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "authorization-results.md"),
    `# Authorization check results\n\nGenerated: ${new Date().toISOString()}\n\n` +
      `| ID | Role | Action | Request | Expected | Observed (HTTP) | Result | Evidence |\n` +
      `|---|---|---|---|---|---|---|---|\n${rows}\n`,
  );
});

// ---------------------------------------------------------------- API checks

test("AC-01 doctor can read an encounter in their facility", async ({ request }) => {
  const res = await request.get(`${API}/api/v1/encounter/${ctx.encounter.id}/`, {
    headers: auth(ctx.doctor),
  });
  const body = res.ok() ? await res.json() : null;
  const observed: Decision = res.status() === 200 && body?.id === ctx.encounter.id ? "Allowed" : "Denied";
  record({
    id: "AC-01",
    role: "care-doctor",
    action: "Read encounter",
    request: "GET /api/v1/encounter/{id}/",
    expected: "Allowed",
    observed,
    http_status: res.status(),
    evidence: `Response body id matches requested encounter (${observed === "Allowed"})`,
  });
  expect(observed).toBe("Allowed");
});

test("AC-02 volunteer cannot read the same encounter", async ({ request }) => {
  const res = await request.get(`${API}/api/v1/encounter/${ctx.encounter.id}/`, {
    headers: auth(ctx.volunteer),
  });
  const text = await res.text();
  const observed: Decision = res.status() === 200 ? "Allowed" : "Denied";
  record({
    id: "AC-02",
    role: "care-volunteer",
    action: "Read encounter",
    request: "GET /api/v1/encounter/{id}/",
    expected: "Denied",
    observed,
    http_status: res.status(),
    evidence: `Body: ${text.slice(0, 120)}`,
  });
  expect(res.status()).toBe(403);
});

test("AC-03 doctor can list facility encounters", async ({ request }) => {
  const res = await request.get(`${API}/api/v1/encounter/?facility=${ctx.facilityId}`, {
    headers: auth(ctx.doctor),
  });
  const body = await res.json();
  const observed: Decision = res.status() === 200 && body.count > 0 ? "Allowed" : "Denied";
  record({
    id: "AC-03",
    role: "care-doctor",
    action: "List facility encounters",
    request: "GET /api/v1/encounter/?facility={id}",
    expected: "Allowed",
    observed,
    http_status: res.status(),
    evidence: `count=${body.count}`,
  });
  expect(observed).toBe("Allowed");
});

test("AC-04 volunteer listing facility encounters receives no records", async ({ request }) => {
  const res = await request.get(`${API}/api/v1/encounter/?facility=${ctx.facilityId}`, {
    headers: auth(ctx.volunteer),
  });
  const body = await res.json().catch(() => ({}));
  // get_filtered_encounters() filters by the user's facility-organization roles,
  // so denial appears as an empty result set rather than HTTP 403.
  const observed: Decision = res.status() === 200 && (body.count ?? 0) > 0 ? "Allowed" : "Denied";
  record({
    id: "AC-04",
    role: "care-volunteer",
    action: "List facility encounters",
    request: "GET /api/v1/encounter/?facility={id}",
    expected: "Denied",
    observed,
    http_status: res.status(),
    evidence: `count=${body.count ?? "n/a"} (queryset filtered by role; see authorization/encounter.py get_filtered_encounters)`,
  });
  expect(body.count ?? 0).toBe(0);
});

test("AC-05 volunteer cannot create an encounter", async ({ request }) => {
  const res = await request.post(`${API}/api/v1/encounter/`, {
    headers: auth(ctx.volunteer),
    data: {
      patient: ctx.encounter.patient.id,
      facility: ctx.facilityId,
      status: "in_progress",
      encounter_class: "amb",
      priority: "routine",
      organizations: [ctx.organizationId],
      period: { start: new Date().toISOString() },
    },
  });
  const text = await res.text();
  const observed: Decision = [200, 201].includes(res.status()) ? "Allowed" : "Denied";
  record({
    id: "AC-05",
    role: "care-volunteer",
    action: "Create encounter",
    request: "POST /api/v1/encounter/",
    expected: "Denied",
    observed,
    http_status: res.status(),
    evidence: `Body: ${text.slice(0, 120)}`,
  });
  expect(res.status()).toBe(403);
});

test("AC-06 volunteer cannot update an encounter", async ({ request }) => {
  const e = ctx.encounter;
  const res = await request.put(`${API}/api/v1/encounter/${e.id}/`, {
    headers: auth(ctx.volunteer),
    data: { status: "cancelled", period: e.period, priority: e.priority },
  });
  const text = await res.text();
  const observed: Decision = [200, 202].includes(res.status()) ? "Allowed" : "Denied";
  // Confirm the record really did not change.
  const after = await (
    await request.get(`${API}/api/v1/encounter/${e.id}/`, { headers: auth(ctx.doctor) })
  ).json();
  record({
    id: "AC-06",
    role: "care-volunteer",
    action: "Update encounter status",
    request: "PUT /api/v1/encounter/{id}/",
    expected: "Denied",
    observed,
    http_status: res.status(),
    evidence: `Body: ${text.slice(0, 100)}; status after request still "${after.status}"`,
  });
  expect(res.status()).toBe(403);
  expect(after.status).toBe(e.status);
});

test("AC-07 doctor can update an open encounter (no-op PUT)", async ({ request }) => {
  const e = ctx.encounter;
  test.skip(!OPEN_STATUSES.includes(e.status), "No open encounter available for a no-op update");
  const res = await request.put(`${API}/api/v1/encounter/${e.id}/`, {
    headers: auth(ctx.doctor),
    data: {
      status: e.status,
      period: e.period,
      hospitalization: e.hospitalization,
      priority: e.priority,
      external_identifier: e.external_identifier,
      discharge_summary_advice: e.discharge_summary_advice,
    },
  });
  const observed: Decision = [200, 202].includes(res.status()) ? "Allowed" : "Denied";
  record({
    id: "AC-07",
    role: "care-doctor",
    action: "Update encounter (same values)",
    request: "PUT /api/v1/encounter/{id}/",
    expected: "Allowed",
    observed,
    http_status: res.status(),
    evidence: `Encounter status "${e.status}" re-sent unchanged`,
  });
  expect(observed).toBe("Allowed");
});

test("AC-08 unauthenticated request is rejected", async ({ request }) => {
  const res = await request.get(`${API}/api/v1/encounter/${ctx.encounter.id}/`);
  const observed: Decision = res.status() === 200 ? "Allowed" : "Denied";
  record({
    id: "AC-08",
    role: "anonymous (no token)",
    action: "Read encounter",
    request: "GET /api/v1/encounter/{id}/",
    expected: "Denied",
    observed,
    http_status: res.status(),
    evidence: `Body: ${(await res.text()).slice(0, 100)}`,
  });
  expect(observed).toBe("Denied");
});

// ----------------------------------------------------------------- UI checks

async function uiLogin(page: Page, username: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(username);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
}

async function openEncounterPage(page: Page, username: string) {
  const e = ctx.encounter;
  const encounterApi = new RegExp(`/api/v1/encounter/${e.id}/(\\?|$)`);
  const statuses: number[] = [];
  page.on("response", (r) => {
    if (encounterApi.test(r.url()) && r.request().method() === "GET") statuses.push(r.status());
  });
  await uiLogin(page, username);
  await page.goto(
    `/facility/${ctx.facilityId}/patient/${e.patient.id}/encounter/${e.id}/updates`,
    { waitUntil: "commit" },
  );
  return statuses;
}

test("AC-09 doctor opens encounter page in the browser", async ({ page }) => {
  const statuses = await openEncounterPage(page, "care-doctor");
  await expect(page.getByRole("region", { name: "Encounter", exact: true })).toBeVisible();
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, "AC-09-doctor-encounter.png"), fullPage: true });
  record({
    id: "AC-09",
    role: "care-doctor",
    action: "Open encounter page (UI)",
    request: "/facility/{f}/patient/{p}/encounter/{e}/updates",
    expected: "Allowed",
    observed: statuses.includes(200) ? "Allowed" : "Denied",
    http_status: statuses.join(",") || "none",
    evidence: "Encounter region visible; screenshots/AC-09-doctor-encounter.png",
  });
  expect(statuses).toContain(200);
});

test("AC-10 volunteer opens the same encounter page in the browser", async ({ page }) => {
  const statuses = await openEncounterPage(page, "care-volunteer");
  // Wait until the SPA has asked the API for the encounter, then give it time to render.
  await expect.poll(() => statuses.length, { timeout: 15000 }).toBeGreaterThan(0);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const encounterRegionVisible = await page
    .getByRole("region", { name: "Encounter", exact: true })
    .isVisible();
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOT_DIR, "AC-10-volunteer-encounter.png"), fullPage: true });
  const observed: Decision = statuses.includes(200) || encounterRegionVisible ? "Allowed" : "Denied";
  record({
    id: "AC-10",
    role: "care-volunteer",
    action: "Open encounter page (UI)",
    request: "/facility/{f}/patient/{p}/encounter/{e}/updates",
    expected: "Denied",
    observed,
    http_status: statuses.join(",") || "none",
    evidence: `Encounter region visible=${encounterRegionVisible}; screenshots/AC-10-volunteer-encounter.png`,
  });
  expect(statuses).not.toContain(200);
  expect(encounterRegionVisible).toBe(false);
});
