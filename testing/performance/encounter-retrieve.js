// k6 OSS workload: GET /api/v1/encounter/{id}/ as the synthetic care-doctor.
//
//   k6 run -e VUS=1 -e RUN_ID=vu1-run1 encounter-retrieve.js
//   k6 run -e VUS=5 -e RUN_ID=vu5-run1 encounter-retrieve.js
//
// Phases: 10 s ramp to VUS users (tag phase=ramp, not measured), then 60 s at
// VUS users (tag phase=steady, measured). Targets: testing/performance/TARGETS.md
import http from "k6/http";
import { check } from "k6";

const API = __ENV.API || "http://127.0.0.1:9000";
const VUS = Number(__ENV.VUS || 1);
const RUN_ID = __ENV.RUN_ID || `vu${VUS}`;
const P95_LIMIT_MS = VUS <= 1 ? 500 : 1000;
const USERNAME = "care-doctor"; // synthetic fixture account
const PASSWORD = __ENV.CARE_FIXTURE_PASSWORD || "Ohcn@123";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [{ duration: "10s", target: VUS }],
      gracefulRampDown: "0s",
      gracefulStop: "0s",
      tags: { phase: "ramp" },
    },
    steady: {
      executor: "constant-vus",
      vus: VUS,
      duration: "60s",
      startTime: "10s",
      gracefulStop: "5s",
      tags: { phase: "steady" },
    },
  },
  thresholds: {
    // The pass/fail criteria are applied to the measured (steady) phase only.
    "http_req_duration{phase:steady}": [`p(95)<=${P95_LIMIT_MS}`],
    "http_req_failed{phase:steady}": ["rate<0.01"],
    "http_reqs{phase:steady}": ["count>0"],
    "checks{phase:steady}": ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function setup() {
  const login = http.post(
    `${API}/api/v1/auth/login/`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { phase: "setup" } },
  );
  if (login.status !== 200) throw new Error(`login failed: ${login.status}`);
  const token = login.json("access");
  const auth = { headers: { Authorization: `Bearer ${token}` }, tags: { phase: "setup" } };
  const facility = http.get(`${API}/api/v1/facility/`, auth).json("results.0.id");
  const encounters = http.get(`${API}/api/v1/encounter/?facility=${facility}&limit=1`, auth);
  const encounterId = encounters.json("results.0.id");
  if (!encounterId) throw new Error("no encounter visible to care-doctor");
  return { token, encounterId };
}

export default function (data) {
  const res = http.get(`${API}/api/v1/encounter/${data.encounterId}/`, {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { name: "GET /api/v1/encounter/{id}/" },
  });
  check(res, {
    "status is 200": (r) => r.status === 200,
    "returns the requested encounter": (r) => r.status === 200 && r.json("id") === data.encounterId,
  });
}

export function handleSummary(data) {
  const m = data.metrics;
  const steadyReqs = m["http_reqs{phase:steady}"]?.values.count ?? 0;
  const result = {
    run_id: RUN_ID,
    vus: VUS,
    measured_window_s: 60,
    p95_ms: m["http_req_duration{phase:steady}"]?.values["p(95)"],
    median_ms: m["http_req_duration{phase:steady}"]?.values.med,
    max_ms: m["http_req_duration{phase:steady}"]?.values.max,
    requests: steadyReqs,
    requests_per_second: steadyReqs / 60,
    failure_rate_pct: (m["http_req_failed{phase:steady}"]?.values.rate ?? 0) * 100,
    p95_limit_ms: P95_LIMIT_MS,
    failure_limit_pct: 1,
    thresholds_passed: Object.fromEntries(
      Object.entries(m)
        .filter(([, v]) => v.thresholds)
        .map(([k, v]) => [k, Object.values(v.thresholds).every((t) => t.ok)]),
    ),
  };
  return {
    [`results/${RUN_ID}-summary.json`]: JSON.stringify(result, null, 2),
    [`results/${RUN_ID}-k6-summary-full.json`]: JSON.stringify(data, null, 2),
    stdout: `\n${RUN_ID}: p95=${result.p95_ms?.toFixed(1)} ms, ${result.requests_per_second.toFixed(1)} req/s, failures=${result.failure_rate_pct.toFixed(2)}%\n`,
  };
}
