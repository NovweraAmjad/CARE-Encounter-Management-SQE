/**
 * OWASP ZAP PASSIVE assessment of the two CARE encounter workflows.
 *
 * 1. Starts ZAP in daemon (headless) mode as a local proxy on 127.0.0.1:8090.
 * 2. Runs the unchanged Section 3 Playwright workflows through that proxy.
 * 3. Waits until ZAP's passive scanner has processed every recorded message.
 * 4. Exports alerts, HTML/JSON reports and the observed response headers/cookies.
 * 5. Shuts ZAP down.
 *
 * No spider and no active scan are ever started: ZAP only observes traffic that
 * the normal application workflows generate.
 *
 * Usage (from testing/security):
 *   set ZAP_HOME to the folder containing zap-<version>.jar, then
 *   node zap/run-zap-passive.js
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ZAP_HOME = process.env.ZAP_HOME;
const PORT = Number(process.env.ZAP_PORT ?? 8090);
const ZAP = `http://127.0.0.1:${PORT}`;
const WORKDIR = process.env.ZAP_WORKDIR ?? path.join(os.tmpdir(), "care-zap-home");
const OUT = path.join(__dirname, "reports");
const E2E_DIR = path.resolve(__dirname, "..", "..", "e2e");
// Frontend (4000) and backend API (9000). The host name the SPA uses for the API
// depends on care_fe's env, so reports cover every observed site on these ports.
const APP_PORTS = ["4000", "9000"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p) => {
  const res = await fetch(`${ZAP}${p}`);
  if (!res.ok) throw new Error(`ZAP API ${p} -> ${res.status}`);
  return p.startsWith("/OTHER/") ? res.text() : res.json();
};

function findJar() {
  if (!ZAP_HOME) throw new Error("Set ZAP_HOME to the ZAP install folder");
  const jar = fs.readdirSync(ZAP_HOME).find((f) => /^zap-[\d.]+\.jar$/.test(f));
  if (!jar) throw new Error(`No zap-<version>.jar in ${ZAP_HOME}`);
  return path.join(ZAP_HOME, jar);
}

async function waitFor(fn, label, timeoutMs = 180000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {
      /* not ready yet */
    }
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function runWorkflows() {
  return new Promise((resolve) => {
    const child = spawn(
      "npx playwright test --config=../security/playwright.zap.config.ts",
      { cwd: E2E_DIR, shell: true, stdio: "inherit", env: { ...process.env, ZAP_PROXY: ZAP } },
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function headerLines(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean);
}

async function collectHeaders(targets) {
  // Summarise each distinct (method, path) once: response headers + Set-Cookie.
  const seen = new Map();
  const cookies = [];
  for (const base of targets) {
    let start = 0;
    for (;;) {
      const { messages } = await api(
        `/JSON/core/view/messages/?baseurl=${encodeURIComponent(base)}&start=${start}&count=200`,
      );
      if (!messages || messages.length === 0) break;
      for (const m of messages) {
        const [reqLine] = String(m.requestHeader).split(/\r?\n/);
        const [method, url] = reqLine.split(" ");
        const u = new URL(url);
        const key = `${method} ${u.origin}${u.pathname.replace(/[0-9a-f-]{36}/g, "{uuid}")}`;
        const headers = headerLines(m.responseHeader);
        for (const h of headers) {
          if (/^set-cookie:/i.test(h)) cookies.push({ request: key, header: h });
        }
        if (!seen.has(key)) {
          seen.set(key, {
            request: key,
            status: String(m.responseHeader).split(/\r?\n/)[0],
            response_headers: headers.filter(
              (h) => !/^(date|content-length|etag|last-modified):/i.test(h),
            ),
          });
        }
      }
      start += messages.length;
    }
  }
  return { endpoints: [...seen.values()], set_cookie_headers: cookies };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(WORKDIR, { recursive: true });

  const jar = findJar();
  console.log(`Starting ZAP daemon (${path.basename(jar)}) on ${ZAP}`);
  const zap = spawn(
    "java",
    [
      "-Xmx1g", "-jar", jar, "-daemon", "-silent",
      "-host", "127.0.0.1", "-port", String(PORT), "-dir", WORKDIR,
      "-config", "api.disablekey=true",
      "-config", "api.addrs.addr.name=127.0.0.1",
      "-config", "api.addrs.addr.regex=false",
    ],
    { cwd: ZAP_HOME, stdio: ["ignore", "pipe", "pipe"] },
  );
  const zapLog = fs.createWriteStream(path.join(OUT, "zap-daemon.log"));
  zap.stdout.pipe(zapLog);
  zap.stderr.pipe(zapLog);

  let exitCode = 1;
  try {
    await waitFor(async () => (await api("/JSON/core/view/version/")).version, "ZAP start");
    const { version } = await api("/JSON/core/view/version/");
    await api("/JSON/core/action/newSession/?overwrite=true");
    const scanners = (await api("/JSON/pscan/view/scanners/")).scanners;
    console.log(`ZAP ${version} ready; ${scanners.filter((s) => s.enabled === "true").length} passive rules enabled`);

    const started = new Date().toISOString();
    const workflowExit = await runWorkflows();
    console.log(`Playwright workflows exit code: ${workflowExit}`);

    // The Vite dev server serves hundreds of un-bundled source modules, so the
    // passive queue can take several minutes to drain. Wait up to 20 minutes.
    let lastLogged = -1;
    await waitFor(
      async () => {
        const left = Number((await api("/JSON/pscan/view/recordsToScan/")).recordsToScan);
        if (left !== lastLogged && (lastLogged === -1 || Math.abs(lastLogged - left) >= 100 || left === 0)) {
          console.log(`  passive scan queue: ${left} records left`);
          lastLogged = left;
        }
        return left === 0;
      },
      "passive scan queue to drain",
      20 * 60 * 1000,
    );

    const sites = (await api("/JSON/core/view/sites/")).sites;
    const targets = sites.filter((s) => APP_PORTS.includes(new URL(s).port));
    const alerts = [];
    for (const base of targets) {
      const { alerts: a } = await api(
        `/JSON/core/view/alerts/?baseurl=${encodeURIComponent(base)}&start=0&count=5000`,
      );
      alerts.push(...a);
    }
    // Group by rule so the report is readable (one row per alert type).
    const byRule = {};
    for (const a of alerts) {
      const k = `${a.pluginId}|${a.alert}`;
      byRule[k] ??= {
        pluginId: a.pluginId, alert: a.alert, risk: a.risk, confidence: a.confidence,
        cweid: a.cweid, wascid: a.wascid, description: a.description,
        solution: a.solution, reference: a.reference, instances: [],
      };
      byRule[k].instances.push({ method: a.method, url: a.url, param: a.param, evidence: a.evidence });
    }
    const riskOrder = { High: 0, Medium: 1, Low: 2, Informational: 3 };
    const summary = Object.values(byRule).sort(
      (x, y) => riskOrder[x.risk] - riskOrder[y.risk] || x.alert.localeCompare(y.alert),
    );

    const { numberOfMessages: msgCount } = await api("/JSON/core/view/numberOfMessages/?baseurl=");

    fs.writeFileSync(path.join(OUT, "zap-alerts.json"), JSON.stringify(alerts, null, 2));
    fs.writeFileSync(
      path.join(OUT, "zap-alerts-summary.json"),
      JSON.stringify(
        {
          zap_version: version, mode: "passive only (no spider, no active scan)",
          started, finished: new Date().toISOString(), workflow_exit_code: workflowExit,
          messages_observed: Number(msgCount), sites_observed: sites, targets,
          alert_types: summary.map((s) => ({ ...s, count: s.instances.length })),
        },
        null,
        2,
      ),
    );
    fs.writeFileSync(path.join(OUT, "zap-report.html"), await api("/OTHER/core/other/htmlreport/"));
    fs.writeFileSync(path.join(OUT, "zap-report.json"), await api("/OTHER/core/other/jsonreport/"));
    fs.writeFileSync(
      path.join(OUT, "observed-response-headers.json"),
      JSON.stringify(await collectHeaders(targets), null, 2),
    );

    console.log(`\nMessages observed: ${msgCount}`);
    for (const s of summary) console.log(`  [${s.risk}] ${s.alert} (${s.instances.length})`);
    exitCode = workflowExit;
  } catch (err) {
    console.error(err);
  } finally {
    await fetch(`${ZAP}/JSON/core/action/shutdown/`).catch(() => undefined);
    await sleep(3000);
    if (!zap.killed) zap.kill();
  }
  process.exit(exitCode);
})();
