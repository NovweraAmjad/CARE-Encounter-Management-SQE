/**
 * Classify the ZAP passive alerts and build a response-header matrix.
 *
 * Inputs : zap/reports/zap-alerts-summary.json, zap/reports/observed-response-headers.json
 * Outputs: zap/reports/zap-analysis.md, zap/reports/zap-analysis.json
 *
 * Each alert type is split by component (port 4000 = Vite DEV server for the React
 * frontend, port 9000 = Django REST backend) and labelled with a classification that
 * was decided by checking the source/config named in the "basis" text.
 * Usage: node zap/analyze-zap.js   (from testing/security)
 */
const fs = require("node:fs");
const path = require("node:path");

const R = path.join(__dirname, "reports");
const summary = JSON.parse(fs.readFileSync(path.join(R, "zap-alerts-summary.json"), "utf8"));
const headers = JSON.parse(fs.readFileSync(path.join(R, "observed-response-headers.json"), "utf8"));

const component = (url) => {
  const port = new URL(url).port;
  if (port === "4000") return "frontend (Vite dev server :4000)";
  if (port === "9000") return "backend API (Django :9000)";
  return new URL(url).host;
};
const normalise = (url) => {
  const u = new URL(url);
  return `${u.host}${u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "{uuid}")}`;
};

// Classification per (pluginId, component). Each one was checked by hand.
const DEV = "Development-server artifact";
const FP = "False positive";
const GENUINE = "Genuine observation";
const INFO = "Informational";
const RULES = {
  "10038|frontend": [DEV, "Vite dev server sends no security headers. Production nginx (care_fe/nginx/nginx.conf:14) sends only Content-Security-Policy-Report-Only, which is NOT enforced -> reported as finding F-02."],
  "10038|backend": [INFO, "JSON API responses (Content-Type application/json) are not rendered as HTML; CSP matters for the HTML document served by the frontend."],
  "10020|frontend": [DEV, "Production nginx sets X-Frame-Options SAMEORIGIN (care_fe/nginx/nginx.conf:10). Not present on the dev server only."],
  "10020|backend": [GENUINE, "Check observed backend headers; base.py sets X_FRAME_OPTIONS='DENY'."],
  "10021|frontend": [DEV, "Production nginx sets X-Content-Type-Options nosniff (nginx.conf:11). Vite dev server does not."],
  "10021|backend": [GENUINE, "Django SecurityMiddleware should send nosniff; see header matrix."],
  "2|frontend": [FP, "'192.168.0.1' is inside a code comment in care_fe/src/hooks/use-auto-space.ts:62 (example of a dotted number), not a disclosed host."],
  "10096|frontend": [FP, "Large integers inside third-party library code (react-dom, libphonenumber examples), not server timestamps."],
  "10096|backend": [FP, "Numeric values in JSON payloads (e.g. IDs/years), not server timestamps."],
  "10024|frontend": [FP, "?token= is Vite's HMR WebSocket token (care_fe/node_modules/vite/dist/client/client.mjs:947, `new WebSocket(...?token=${wsToken}, 'vite-hmr')`). CARE never puts its JWT in a URL; it sends it only as an Authorization header (src/Utils/request/utils.ts:90)."],
  "10027|frontend": [DEV, "Dev server serves un-minified source and vendor bundles with comments. Production build is minified."],
  "10109|frontend": [INFO, "Identifies a single-page application; no vulnerability."],
  "10112|frontend": [FP, "Matched a translation key named 'token' in /locale/en.json, not a session token."],
  "10112|backend": [INFO, "Token refresh response body returns a new JWT access token (expected for the bearer-token design; storage reviewed in F-01)."],
  "10036|backend": [DEV, "'Werkzeug/3.1.6 Python/3.13.18' comes from runserver_plus used by care/scripts/start-dev.sh (docker-compose.local.yaml). Production runs gunicorn (care/Procfile, care/scripts/start.sh:28). Hide Server banner at the reverse proxy in production."],
  "10098|backend": [GENUINE, "Access-Control-Allow-Origin: * comes from CORS_ORIGIN_ALLOW_ALL=True in care/config/settings/local.py:12 (local settings only; deployment.py uses an allow-list) -> finding F-04."],
  "10003|frontend": [DEV, "Retire.js match on a dev-served library; cross-checked against npm audit (dependency-audit/)."],
  "90004|frontend": [DEV, "Cross-Origin isolation headers absent on the dev server."],
  "90004|backend": [INFO, "Cross-Origin-Resource-Policy absent on JSON API responses."],
  "10049|frontend": [INFO, "Cacheability classification of static assets."],
  "10049|backend": [INFO, "Cacheability classification of API responses."],
  "10015|backend": [INFO, "Cache-control directives on API responses; see header matrix."],
  "10111|backend": [INFO, "Authentication request identified (POST /api/v1/auth/login/)."],
  "10113|backend": [INFO, "Verification request identified."],
  "90003|frontend": [DEV, "Sub Resource Integrity applies to third-party hosted scripts; all scripts here are same-origin dev modules."],
  "10055|frontend": [DEV, "CSP rule on dev server; see 10038."],
};

const rows = [];
for (const a of summary.alert_types) {
  const byComp = {};
  for (const i of a.instances) (byComp[component(i.url)] ??= []).push(i);
  for (const [comp, inst] of Object.entries(byComp)) {
    const key = `${a.pluginId}|${comp.startsWith("frontend") ? "frontend" : comp.startsWith("backend") ? "backend" : "other"}`;
    const [classification, basis] = RULES[key] ?? ["Needs manual review", "No classification rule; review the instances in zap-alerts.json."];
    const endpoints = [...new Set(inst.map((i) => `${i.method} ${normalise(i.url)}`))];
    const evidence = [...new Set(inst.map((i) => [i.param, String(i.evidence ?? "").slice(0, 70)].filter(Boolean).join(": ")).filter(Boolean))];
    rows.push({
      pluginId: a.pluginId, alert: a.alert, risk: a.risk, confidence: a.confidence, cwe: a.cweid,
      component: comp, instances: inst.length, distinct_endpoints: endpoints.length,
      sample_endpoints: endpoints.slice(0, 4), sample_evidence: evidence.slice(0, 3),
      classification, basis,
    });
  }
}
const riskOrder = { High: 0, Medium: 1, Low: 2, Informational: 3 };
rows.sort((x, y) => riskOrder[x.risk] - riskOrder[y.risk] || x.alert.localeCompare(y.alert) || x.component.localeCompare(y.component));

// Header matrix for the backend API and the frontend HTML document.
const WANT = ["x-frame-options", "x-content-type-options", "referrer-policy", "cross-origin-opener-policy",
  "content-security-policy", "content-security-policy-report-only", "strict-transport-security",
  "access-control-allow-origin", "cache-control", "vary"];
// Status-0 rows with no headers are ZAP site-tree parent nodes (/, /api, /api/v1 ...),
// not real HTTP responses, so they are excluded.
const placeholderRows = headers.endpoints.filter((e) => / 0$/.test(e.status.trim()) && e.response_headers.length === 0);
const headerRows = headers.endpoints
  .filter((e) => !placeholderRows.includes(e))
  .filter((e) => /:9000\//.test(e.request) || /:4000\/(login|facility\/)/.test(e.request))
  .map((e) => {
    const map = {};
    for (const h of e.response_headers) {
      const i = h.indexOf(":");
      map[h.slice(0, i).toLowerCase()] = h.slice(i + 1).trim();
    }
    return { request: e.request, status: e.status.split(" ")[1], ...Object.fromEntries(WANT.map((w) => [w, map[w] ?? "—"])) };
  });
const apiRows = headerRows.filter((r) => r.request.includes(":9000/"));

const out = {
  zap_version: summary.zap_version, mode: summary.mode, messages_observed: summary.messages_observed,
  sites_observed: summary.sites_observed, workflow_exit_code: summary.workflow_exit_code,
  set_cookie_headers_observed: headers.set_cookie_headers.length,
  backend_api_requests_captured: apiRows.length,
  zap_site_tree_placeholders_excluded: placeholderRows.length,
  alerts: rows, header_matrix: headerRows,
};
fs.writeFileSync(path.join(R, "zap-analysis.json"), JSON.stringify(out, null, 2));

const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
let md = `# ZAP passive scan analysis\n\n`;
md += `- ZAP ${summary.zap_version}, ${summary.mode}\n- Sites observed: ${summary.sites_observed.join(", ")}\n`;
md += `- Messages recorded: ${summary.messages_observed}; distinct backend API requests captured (method + path): ${apiRows.length} (${placeholderRows.length} ZAP site-tree placeholder nodes with no response excluded)\n`;
md += `- Set-Cookie headers observed in all traffic: **${headers.set_cookie_headers.length}**\n`;
md += `- Playwright workflows exit code under proxy: ${summary.workflow_exit_code}\n\n`;
md += `## Alerts by risk, component and classification\n\n`;
md += `| Risk | Confidence | Alert (plugin) | Component | Instances | Sample endpoints | Sample evidence | Classification | Basis |\n|---|---|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  md += `| ${r.risk} | ${r.confidence} | ${esc(r.alert)} (${r.pluginId}) | ${r.component} | ${r.instances} | ${esc(r.sample_endpoints.join("<br>"))} | ${esc(r.sample_evidence.join("<br>") || "—")} | **${r.classification}** | ${esc(r.basis)} |\n`;
}
md += `\n## Response headers observed (backend API + frontend HTML)\n\n`;
md += `| Request | Status | ${WANT.join(" | ")} |\n|---|---|${WANT.map(() => "---").join("|")}|\n`;
for (const r of headerRows) md += `| ${esc(r.request)} | ${r.status} | ${WANT.map((w) => esc(r[w])).join(" | ")} |\n`;
fs.writeFileSync(path.join(R, "zap-analysis.md"), md);
console.log(md.split("## Response headers")[0]);
console.log(`header rows: ${headerRows.length} (api: ${apiRows.length})`);
