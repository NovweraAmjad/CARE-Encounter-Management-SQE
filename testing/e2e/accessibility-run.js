/**
 * Section 3 accessibility / usability audit of the two encounter key screens.
 *
 * Usage (from testing/e2e, frontend on :4000, backend on :9000):
 *   node accessibility-run.js before     -> testing/accessibility/before/
 *   node accessibility-run.js after      -> testing/accessibility/after/
 *
 * For each key screen, while logged in as the synthetic care-doctor account:
 *   Create Encounter  - Lighthouse NAVIGATION of Patient Home (full Best Practices/SEO)
 *                     - Lighthouse SNAPSHOT of the open "Create Encounter" dialog
 *                       (a navigation reload would close the dialog)
 *                     - full-page axe-core scan with the dialog open
 *   Complete Encounter- Lighthouse NAVIGATION of the encounter updates screen
 *                     - full-page axe-core scan
 * Categories: accessibility, best-practices, seo.
 */
const fs = require("node:fs");
const path = require("node:path");

const PHASE = process.argv[2] ?? "before";
if (!["before", "after"].includes(PHASE)) {
  throw new Error('Usage: node accessibility-run.js <before|after>');
}
const API = "http://127.0.0.1:9000";
const FRONTEND = "http://127.0.0.1:4000";
const USERNAME = "care-doctor"; // synthetic fixture account
const PASSWORD = process.env.CARE_FIXTURE_PASSWORD ?? "Ohcn@123";
const OUT_DIR = path.resolve(__dirname, "..", "accessibility", PHASE);
const CATEGORIES = ["accessibility", "best-practices", "seo"];

async function apiLogin() {
  const response = await fetch(`${API}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`Login failed: ${response.status}`);
  return (await response.json()).access;
}

async function api(access, url, method = "GET", body) {
  const response = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

async function getFixture(access) {
  const facilityId = (await api(access, "/api/v1/facility/")).data.results[0].id;
  const encounter = (await api(access, `/api/v1/encounter/?facility=${facilityId}`)).data.results[0];
  const orgs = (await api(access, `/api/v1/facility/${facilityId}/organizations/`)).data.results;
  const organizationId = orgs.find((o) => o.org_type !== "root")?.id ?? orgs[0].id;
  return { facilityId, patientId: encounter.patient.id, organizationId };
}

async function browserLogin(page) {
  await page.goto(`${FRONTEND}/login`);
  await page.getByRole("textbox", { name: "Username" }).fill(USERNAME);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
}

function axeSummary(results) {
  return {
    url: results.url,
    timestamp: results.timestamp,
    testEngine: results.testEngine,
    violationCount: results.violations.length,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })),
    })),
  };
}

function axeMarkdown(title, results) {
  const lines = [`# axe-core report (${PHASE}): ${title}`, "", `- URL: ${results.url}`,
    `- Timestamp: ${results.timestamp}`, `- axe-core: ${results.testEngine?.version}`,
    `- Violations: ${results.violations.length} rule(s)`, ""];
  for (const v of results.violations) {
    lines.push(`## ${v.id} (${v.impact ?? "unknown"})`, "", v.help, "");
    for (const n of v.nodes) {
      lines.push(`- Selector: \`${n.target.join(" ")}\``, `  - HTML: \`${n.html.replace(/`/g, "'")}\``);
      if (n.failureSummary) lines.push(`  - Failure: ${n.failureSummary.replace(/\n/g, " ")}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

/** Failing (score < 1) audits for each category, with the offending items. */
function lighthouseFailures(lhr) {
  const out = {};
  for (const [cid, cat] of Object.entries(lhr.categories)) {
    out[cid] = cat.auditRefs
      .map((ref) => ({ ref, audit: lhr.audits[ref.id] }))
      .filter(({ audit }) => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== "informative")
      .map(({ ref, audit }) => ({
        id: ref.id,
        title: audit.title,
        weight: ref.weight,
        items: (audit.details?.items ?? []).map((i) => ({
          selector: i.node?.selector ?? null,
          snippet: i.node?.snippet ?? null,
          description: i.description ?? null,
          url: i.sourceLocation?.url ?? i.url ?? null,
        })),
      }));
  }
  return out;
}

function saveLighthouse(name, result) {
  fs.writeFileSync(path.join(OUT_DIR, `lighthouse-${name}.json`), result.report[0]);
  fs.writeFileSync(path.join(OUT_DIR, `lighthouse-${name}.html`), result.report[1]);
  const lhr = result.lhr;
  return {
    mode: lhr.gatherMode,
    url: lhr.finalDisplayedUrl ?? lhr.finalUrl,
    lighthouseVersion: lhr.lighthouseVersion,
    scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, c.score])),
    failingAudits: lighthouseFailures(lhr),
  };
}

function saveAxe(name, title, results) {
  fs.writeFileSync(path.join(OUT_DIR, `axe-${name}.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `axe-${name}-summary.json`), JSON.stringify(axeSummary(results), null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `axe-${name}.md`), axeMarkdown(title, results));
  return axeSummary(results);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const chromeLauncher = await import("chrome-launcher");
  const lighthouseModule = await import("lighthouse");
  const lighthouse = lighthouseModule.default;
  const { snapshot } = lighthouseModule;
  const puppeteer = (await import("puppeteer-core")).default;
  const { chromium } = await import("@playwright/test");
  const { default: AxeBuilder } = await import("@axe-core/playwright");

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu", "--window-size=1350,940"],
  });
  let browser;
  let pptr;
  const summary = { phase: PHASE, generated: new Date().toISOString(), account: `${USERNAME} (synthetic fixture account)`, screens: {} };
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${chrome.port}`);
    pptr = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}`, defaultViewport: null });
    const context = browser.contexts()[0];
    const page = await context.newPage();
    await page.setViewportSize({ width: 1350, height: 940 });

    const access = await apiLogin();
    const fixture = await getFixture(access);
    await browserLogin(page);

    // ------------------------------------------------------------ Create Encounter
    const patientHome =
      `${FRONTEND}/facility/${fixture.facilityId}/patient/${fixture.patientId}`;
    await page.goto(patientHome, { waitUntil: "commit" });
    await page.getByRole("link", { name: "Patient Home" }).first().click();
    await page.getByRole("button", { name: "Create Encounter" }).waitFor();
    const createUrl = page.url();

    const createNav = await lighthouse(createUrl, {
      port: chrome.port, output: ["json", "html"], logLevel: "error", onlyCategories: CATEGORIES,
    });
    const createNavSummary = saveLighthouse("create-navigation", createNav);

    await page.getByRole("button", { name: "Create Encounter" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible" });
    await dialog.getByRole("button", { name: /^Create Encounter/ }).waitFor();
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll("[role=dialog] button[type=submit]")][0];
      return b && !b.disabled;
    });

    const createAxe = saveAxe("create", "Create Encounter dialog", await new AxeBuilder({ page }).analyze());
    await page.screenshot({ path: path.join(OUT_DIR, "create-encounter.png"), fullPage: true });

    const pptrPages = await pptr.pages();
    const pptrCreate = pptrPages.find((p) => p.url() === page.url());
    if (!pptrCreate) throw new Error("Could not attach Lighthouse to the dialog page");
    const createSnap = await snapshot(pptrCreate, {
      config: { extends: "lighthouse:default", settings: { onlyCategories: CATEGORIES } },
      flags: { output: ["json", "html"] },
    });
    const createSnapSummary = saveLighthouse("create-dialog-snapshot", createSnap);

    summary.screens.create = {
      name: "Create Encounter (Patient Home + Create Encounter dialog)",
      lighthouseNavigation: createNavSummary,
      lighthouseSnapshot: createSnapSummary,
      axe: { url: createAxe.url, violationCount: createAxe.violationCount, rules: createAxe.violations.map((v) => v.id) },
    };

    // ---------------------------------------------------------- Complete Encounter
    const setup = await api(access, "/api/v1/encounter/", "POST", {
      patient: fixture.patientId, facility: fixture.facilityId, status: "in_progress",
      encounter_class: "amb", priority: "routine", organizations: [fixture.organizationId],
      period: { start: new Date().toISOString() },
    });
    let encounterId = setup.data?.id;
    if (![200, 201].includes(setup.status)) {
      // Patient already at the active-encounter limit: audit an existing open encounter.
      const open = await api(access, `/api/v1/encounter/?facility=${fixture.facilityId}&patient_filter=${fixture.patientId}&status=in_progress,planned,on_hold`);
      encounterId = open.data.results[0]?.id;
    }
    if (!encounterId) throw new Error("No open encounter available for the Complete screen");
    const completeUrl =
      `${FRONTEND}/facility/${fixture.facilityId}/patient/${fixture.patientId}/encounter/${encounterId}/updates`;
    await page.goto(completeUrl);
    await page.getByRole("region", { name: "Encounter", exact: true }).waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("tab", { name: "Actions", exact: true }).click();
    await page.getByRole("tabpanel", { name: "Actions" }).getByRole("button", { name: /Mark as Completed/i }).waitFor();

    const completeAxe = saveAxe("complete", "Complete Encounter (encounter updates screen)", await new AxeBuilder({ page }).analyze());
    await page.screenshot({ path: path.join(OUT_DIR, "complete-encounter.png"), fullPage: true });

    const completeNav = await lighthouse(completeUrl, {
      port: chrome.port, output: ["json", "html"], logLevel: "error", onlyCategories: CATEGORIES,
    });
    const completeNavSummary = saveLighthouse("complete-navigation", completeNav);

    summary.screens.complete = {
      name: "Complete Encounter (encounter updates screen)",
      lighthouseNavigation: completeNavSummary,
      axe: { url: completeAxe.url, violationCount: completeAxe.violationCount, rules: completeAxe.violations.map((v) => v.id) },
    };

    fs.writeFileSync(path.join(OUT_DIR, "audit-summary.json"), JSON.stringify(summary, null, 2));
    const brief = Object.fromEntries(Object.entries(summary.screens).map(([k, s]) => [k, {
      axe: `${s.axe.violationCount} rule(s): ${s.axe.rules.join(", ") || "none"}`,
      lhNavigation: s.lighthouseNavigation.scores,
      lhSnapshot: s.lighthouseSnapshot?.scores,
    }]));
    console.log(JSON.stringify({ phase: PHASE, out: OUT_DIR, ...brief }, null, 2));
  } finally {
    if (pptr) await pptr.disconnect().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
    await chrome.kill();
  }
})();
