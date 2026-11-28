# Test Completion Report – CARE Encounter Management

**Public repository:** https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE (upstream references, baseline commits, setup/reset, scripts, test data, tool versions and CI: see its `README.md`).

**Scope.** Workflow 1 Create Patient Encounter and Workflow 2 Complete Patient Encounter, on a local copy of CARE: backend `ddfd840`, frontend `5e02f9a`. Synthetic fixture data only.

**Period.** 26–28 Nov 2026. **Plan:** `docs/test-plan.md` v1.1.

**Recommendation:** ⛔ **HOLD (do not release).** Open Major defects in server-side validation (DEF-01, DEF-02, DEF-03) and the dependency advisories (DEF-14) fail exit criterion 10. See §7.

## 1. What was tested

| Level | Tests | Result | Evidence |
|---|---|---|---|
| Unit (Django) | 18 | 18 pass | `testing/unit/` |
| API / integration | 51 (incl. 16 from mutation analysis, 49 state transitions in 2 tests, 28 generated EP classes, recovery) | 51 pass | `testing/integration/` |
| Generator (OpenAPI → EP/BVA) | 5 | 5 pass (incl. regenerated v2 spec) | `testing/generators/`, `testing/openapi/` |
| Frontend rules | 3 | 3 pass | `testing/frontend/` |
| Browser use cases | 2 UCs × (main + 2 alternative + 2 exception) = 10 | **30/30 over 3 consecutive runs** | `testing/e2e/specs/` |
| Security (role checks, session) | 12 | 12 pass | `testing/security/` |
| Accessibility (Lighthouse + axe) | 2 key screens, before/after a fix | 6 → 5 unique issues | `testing/accessibility/` |
| Mutation (mutmut 3.8.1) | 418 mutants + 3 custom operators | **92.8%**; custom 3/3 killed | `testing/evidence/mutation-analysis.md` |
| Static analysis (SonarQube) | 9 scoped source files | Gate **OK** after DEF-20 fix | `docs/reports/sonarqube-analysis.md` |
| ZAP passive + dependency audit | both workflows | see Section 4 report | `testing/security/SECTION4-REPORT.md` |
| Performance (k6 OSS) | 1 VU ×2, 5 VUs ×2, 60 s steady | p95 158.7/161.3 ms and 690.5/649.6 ms, 0% failures, all within the pre-set limits | `testing/performance/` |
| Failure and recovery | Redis lock unavailable mid-create | Full rollback; retry creates exactly one record; 3/3 runs | `testing/integration/test_failure_recovery.py` |

**Coverage:**
- 100% statement and branch on every selected business-rule function (gate passes).
- 76.8% line+branch over the 4 scoped backend files.
- Requirements coverage **10/10**.

## 2. What was not tested (and why)

| Not tested | Reason |
|---|---|
| Restart (FR-ENC-10) in the browser | Secondary API-only flow; covered by 6 API tests |
| Roles other than Doctor and Volunteer in the browser | Brief requires 2 roles; others covered at API level through role permissions |
| Production deployment (nginx headers, gunicorn, HTTPS) | Only the local stack exists; checked by configuration review (Section 4) |
| Performance under load | Out of scope; only single-user workflow timing observed |
| Frontend line coverage | No coverage instrumentation on the Vite dev build; frontend verified by Playwright |
| Fixing upstream defects DEF-01/02/03/19 | Product code changes are reported upstream, not made by the test project (except the two fixes in §5) |

## 3. Exit criteria (test plan §10)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | 100% of FR-ENC-01–10 with an executed test | ✅ Met | Traceability: 10/10 |
| 2 | **PR-08 security gate:** all unauthenticated/unauthorized cases pass, no 2xx for denied roles | ✅ Met | SEC-AC-01–10, API-ENC-012/029/036/037/038 |
| 3 | **PJ-02:** CI runs backend + browser suites, publishes artifacts, final regression | ✅ Met | GitHub run 46148402745: all gates green (§6) |
| 4 | **PR-05:** 4-row discharge decision table | ✅ Met | FE-ENC-001 + E2E-ENC-007 |
| 5 | **PR-01:** 4/5/6 active-encounter boundaries | ✅ Met | API-ENC-001/019, UNIT-ENC-001, E2E-ENC-006 |
| 6 | Status-history and period consistency | ✅ Met | API-ENC-003/004/022/034/035, E2E-ENC-008 |
| 7 | 100% statement/branch on the selected logic | ✅ Met | `coverage_quality_gate.py`: PASS |
| 8 | ≥95% API pass rate over 3 runs | ✅ Met | 74/74 on 3 consecutive runs (`testing/evidence/backend-consecutive-runs-2026-11-28.log`) |
| 9 | ≥95% browser pass over 3 runs; each flow < 10 s | ✅ pass rate (30/30) · ⚠️ timing not isolated | Whole tests take 6.9–18.0 s *including* login and API setup; the flow alone was not timed separately |
| 10 | No unresolved Critical/High defect | ❌ **Not met** | DEF-03 and DEF-14 open at P1; DEF-01/02/19/13 open Major |

## 4. Deviations from the plan

1. **The mutation harness was defective (4 defects).** The first runs gave no score, then *false* verdicts (0 survivors instead of 146). It was fixed and everything re-measured (RCA-3, mutation analysis §2). Effort far above estimate.
2. **Use-case scope grew from 2 to 10 browser flows** to meet the brief.
3. **The coverage scope was widened** to include the authorization module. `.coveragerc` was switched to file patterns after module-name `source=` broke a pydantic schema build.
4. **The SonarQube scope was narrowed** to the workflow modules rather than all of CARE. The gate uses overall-code conditions, so it can fail on a fresh server.
5. **CI SonarQube runs as a job service** (fresh per run) instead of relying on an external server and secrets.

## 5. Defects

20 recorded. Full register: `docs/defects/defect-register.md`.
- 14 open, 5 fixed, 1 won't fix, 0 reopened.
- **Defect density** 4.3 / KLOC (9 defects in 2,096 in-scope LOC).

**Fixed in this project:**
- DEF-04 (accessibility patch)
- DEF-20 (floating promises; SonarQube gate ERROR → OK; delivered through a pull request)
- DEF-16, 17, 18 (test infrastructure and docs)

**Open, by severity:**

| ID | Severity / priority | Summary |
|---|---|---|
| DEF-03 | Major / **P1** | API accepts a non-planned encounter with a future start (BR-ENC-02 bypass) |
| DEF-14 | Major / **P1** | Backend dependencies with 119 advisories (7 Critical) |
| DEF-01 | Major / P2 | 101-character `external_identifier` → HTTP 500 |
| DEF-02 | Major / P2 | `hospitalization: null` → HTTP 500 |
| DEF-13 | Major / P2 | JWTs in localStorage + CSP report-only |
| DEF-19 | Major / P2 | `live=true` filter inverted |
| DEF-06 | Major / P3 | Unnamed sheet trigger (accessibility) |
| DEF-05, 07–12 | Minor | Accessibility/usability and a 400 console error |

RCAs (5 Whys + fishbone) with corrective and preventive actions: RCA-1 (DEF-03), RCA-2 (DEF-01/02), RCA-3 (DEF-16), in `docs/defects/rca.md`.

## 6. CI quality gate status

**Workflow** (`.github/workflows/care-quality-gate.yml`): runs on every pull request to `main`/`develop`. No `continue-on-error` and no `|| true`. Three jobs:

| Job | Steps |
|---|---|
| Python tests, coverage and mutation | unit + integration + generator tests → coverage gate (100% on rule functions) → `campaign.py` (mutmut + 3 custom operators) → mutation gate (≥ 80%) |
| Frontend rules, Playwright E2E and security checks | baseline frontend + accessibility patch → frontend rule tests → 10 use-case flows → 12 security checks → Lighthouse |
| SonarQube quality gate | fresh SonarQube service → custom gate (reliability/security/maintainability A, duplication ≤ 3%, coverage ≥ 75%) |

**Local verification of every gate (28 Nov):**

| Gate | Result |
|---|---|
| Backend tests | 74/74 |
| Coverage gate | PASS |
| Mutation gate | 92.82% ≥ 80% PASS |
| E2E | 10/10 (×3) |
| Security | 12/12 |
| Patches apply to a clean baseline | ✅ |
| SonarQube gate | ERROR before DEF-20 fix → OK after |

**GitHub Actions history** (`NovweraAmjad/CARE-Encounter-Management-SQE`, all on 28 Nov 2026):

| Run | Commit | Python + mutation | Frontend E2E + security | SonarQube | What it shows |
|---|---|---|---|---|---|
| 46139520006 | `dc701cf` | ✅ | ❌ | skipped | Mutation campaign works on GitHub. E2E failed: fresh DB (patient visible only through an open encounter), IPv6 `localhost` |
| 46141819500 | `04388fa` | ✅ | ❌ 9/10 | skipped | Remaining failure: first page on a cold Vite server > 10 s |
| 46144666161 | `133f849` | ✅ | ✅ | ✅ | First fully green run; but SonarQube was **blind**: type-aware rules skipped without `node_modules` (`testing/sonar/type-aware-analysis-evidence.md`) |
| **46146842984** | `216c488` | ✅ | ✅ | **❌** | **Fix PR, before:** with type information the gate fails on DEF-20 (5 floating promises) |
| **46148402745** | `f2730c0` | ✅ | ✅ | **✅** | **Fix PR, after:** the DEF-20 fix applied; every gate passes |
| **46148457020** | `sqe/demo-blocked-remove-tests` | **❌ at "Enforce mutation threshold"** | ✅ | skipped | **Blocked PR:** the "redundant" tests were deleted. All remaining tests and the coverage gate still pass, but the mutation score falls below 80% |

**Pull requests:**
- **PR #5** `sqe/complete-quality-gate` → `main` is the **documented fix**: run 46146842984 fails, run 46148402745 passes.
- **Blocked PR:** the demo branch `sqe/demo-blocked-remove-tests` (must not be merged).
- **Deviation:** PR #4 (the first part of this work) was merged with a red pipeline, because branch protection was not yet enabled on `main`. Blocking merges requires the repository owner to enable branch protection with the three gate jobs as required status checks. With it, the demo branch's PR cannot be merged.

## 7. Residual risk per registered risk

| Risk | Initial | Testing done | Residual | Comment |
|---|---|---|---|---|
| PR-01 active limit | Medium (9) | BVA 0/4/5/6, dynamic limit, scope partition, mutation 100% on `validate_data` | **Low** | |
| PR-02 invalid references | High (12) | Nonexistent/malformed UUIDs, exact messages | **Low** | |
| PR-03 invalid enums / future dates | Medium (9) | EP on all enums; UI blocks future start | **High** | DEF-03: API accepts a future in-progress start; DEF-01/02: 500s on invalid input |
| PR-04 status transitions / history | High (12) | Every allowed change + disallowed ones; history read-back; custom operator BR03 killed | **Low** | No backend transition allowlist exists (documented boundary) |
| PR-05 discharge routing | High (15) | 4-row decision table (unit + browser) | **Low** | |
| PR-06 completion period | High (12) | Missing/existing end, naive/ordering, browser ALT-2 | **Low** | |
| PR-07 related records (appointment/token) | High (12) | Booking linked and read back; repeat → 400 | **Medium** | Token-closing branch not exercised in the browser |
| PR-08 authorization | Critical (16) | 10 role checks, API negatives, retrieve/list/create/update permission paths, mutation-killed | **Medium** | Authorization logic verified; DEF-13 (token storage) and DEF-14 (dependencies) keep the security residual above Low |
| PR-09 browser gaps | Medium (6) | 10 use-case flows | **Low** | |
| PR-10 repeated requests | Medium (9) | Repeated create/update/restart; duplicate organizations deduplicated | **Low** | |
| PJ-01 environment | Medium (9) | Docker stack + harness issues resolved | **Low** | |
| PJ-02 schedule | Critical (16) | All phases complete; CI green on GitHub (run 46148402745) | **Low** | Branch protection still to be enabled by the owner |

## 8. Recommendation

**HOLD.** The encounter workflows behave correctly through the UI, and their business rules are well covered (100% rule-function coverage, 92.8% mutation score, 10/10 use-case flows). But:
1. **DEF-03 (P1):** BR-ENC-02 is enforced only in the browser, so any API client can create an invalid encounter.
2. **DEF-14 (P1):** Django/DRF/PyJWT versions carry published advisories on the request path.
3. **DEF-01/02:** client input causes HTTP 500 (unhandled database errors).

**Release when:**
- DEF-03, 01, 02 are fixed with the API tests updated to expect 400.
- Dependencies are upgraded and the suites re-run.
- Branch protection is enforced on `main` (the pipeline itself is already green on GitHub).
