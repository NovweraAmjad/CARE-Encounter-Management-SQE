# Project Audit Index – where every requirement's result is

**Audited:** 28 Nov 2026, against the SE3002 brief (Sections 1–5).

**Legend:**
- ✅ done, with evidence
- ⚠️ done, but needs an owner action on GitHub, or deviates from the brief (reason given)
- ❌ missing

**Latest CI.** PR #5, run 46150197914: all gates green.

## Section 1 – Select and understand the system

| Requirement | Status | Where |
|---|---|---|
| Repo with browser UI, HTTP API, persistent storage, testable source | ✅ | `docs/repository-selection.md` (CARE: React UI + Django REST API + PostgreSQL) |
| Upstream URL, licence, exact commit | ✅ | `docs/repository-selection.md` "Selected baseline": `ohcnetwork/care` @ `ddfd840` (MIT), `ohcnetwork/care_fe` @ `5e02f9a` (MIT); `baseline.md` |
| ≥8 functional requirements, ≥3 per workflow | ✅ | `requirements/functional-requirements.md`: FR-ENC-01–10 (Create: 01–05; Complete: 06–10) |
| 4 business rules incl. boundary, ≥2-condition decision, state change | ✅ | `docs/business-rules.md` BR-ENC-01–06 + table "Rule types required by the brief" |
| 2 user roles with different permissions | ✅ | `docs/business-rules.md` "User roles with different permissions" (Doctor vs Volunteer, from `permissions/encounter.py`) |
| Expected behaviour from docs or justified assumptions | ✅ | `docs/test-basis.md` (sources + "Necessary assumptions") |
| Shared records each workflow reads/changes | ✅ | `docs/workflow-specification.md` "Shared Records Between the Workflows" |
| Baseline saved in Git | ✅ | `baseline.md`, `docs/repository-selection.md` (checkout commands) |
| Install / start / seed / reset commands | ✅ | `docs/repository-selection.md` (Docker Compose up, `npm run local`, `load_fixtures`, "Resetting test data between runs"); `testing/README.md` |

## Section 2 – Plan and automate functional tests

| Requirement | Status | Where |
|---|---|---|
| SonarQube metrics with explanations | ✅ | `docs/reports/sonarqube-analysis.md` §1; raw: `testing/sonar/results-after-fix/` |
| Hand cyclomatic complexity from the CFG vs SonarQube | ✅ | `docs/reports/sonarqube-analysis.md` §4: `validate_data` 5 = 5 (`testing/sonar/cyclomatic-check/`) |
| Test plan (scope, risk approach, roles, env, data, schedule, criteria, risks), kept updated | ✅ | `docs/test-plan.md` v1.1 (+ revision history §16) |
| Three-point estimate per area, compared with actuals | ⚠️ | `docs/test-estimation.md`: PERT per area and completion status; **actual hours must be entered by the author** (not derivable) |
| Risk register ≥8 product + 2 project, L×I on 5×5, level → technique | ✅ | `docs/risk-register.md` (PR-01–10, PJ-01–02, matrix §3, depth §6); `docs/test-plan.md` §4 |
| ≥3 measurable exit criteria, ≥2 tied to highest risks | ✅ | `docs/test-plan.md` §10 (10 criteria; #2 PR-08, #3 PJ-02 Critical); evaluated in `docs/reports/test-completion-report.md` §3 |
| Traceability matrix with requirements coverage | ✅ | `docs/traceability-matrix.md` (10/10 = 100%) |
| Defects with severity/priority/status/triage | ⚠️ | `docs/defects/defect-register.md` (20 defects); issue bodies in `docs/defects/issues/`. **Filing as GitHub Issues: run `docs/defects/create-issues.ps1`** (needs `gh` auth) |
| RCA (5 Whys + fishbone) for ≥2 major defects, corrective + preventive | ✅ | `docs/defects/rca.md` (RCA-1 DEF-03, RCA-2 DEF-01/02, RCA-3 DEF-16) |
| Pareto by category | ✅ | `docs/defects/defect-register.md` "Pareto by category" |
| Weekly progress report with control actions + GQM | ✅ | `docs/reports/weekly-progress-week-48.md` (defect density 4.3/KLOC, requirements coverage 100%, reopen rate 0%) |
| Test completion report (tested/not tested, deviations, open defects, residual risk, recommendation) | ✅ | `docs/reports/test-completion-report.md` (**HOLD**) |
| **Unit:** 100% statement+branch on server-side business logic, uncovered justified | ✅ | `testing/coverage/coverage-report.txt` (gate PASS), `testing/coverage/business-rule-audit.md` |
| **Unit:** MCC then MC/DC for the critical module | ✅ | `testing/coverage/mcc-mcdc.md` |
| **Unit:** all four business rules | ✅ | backend rules: `testing/unit/`; frontend rules (BR-ENC-02/04): `testing/frontend/`, E2E-ENC-001/003/007 |
| **API:** EP + 3-point BVA on every input from generated data | ✅ | generator `testing/generators/encounter_data_generator.py` (`generate_cases`); valid classes API-ENC-045 (28/28); invalid API-ENC-014/020/021; BVA API-ENC-001/019/023 |
| **API:** rule rejections, invalid transitions, repeated requests, read-back after success/rejection | ✅ | `testing/integration/` (API-ENC-015/017/022/026/039/044…), `testing/evidence/test-case-register.csv` |
| **API:** endpoint weaknesses | ✅ | `testing/evidence/endpoint-weaknesses.md` (EW-01–05) → DEF-01/02 |
| Decision tables for every ≥2-condition rule | ✅ | `testing/coverage/mcc-mcdc.md` (BR-01/05/06), FE-ENC-001 (BR-04), E2E-ENC-001/003 + DEF-03 (BR-02) |
| State transitions: every allowed + ≥1 disallowed from each state | ✅ | `testing/integration/test_state_transitions.py` (40 allowed + 9 disallowed), restart: `RestartEligibilityIntegrationTests` |
| **E2E:** 2 use cases, each ≥2 alternative + ≥2 exception flows, automated with UI + post-condition asserts | ✅ | `testing/e2e/specs/encounter-e2e.spec.ts` (main flows), `testing/e2e/specs/use-cases.spec.ts` (8 alt/exc); report `testing/e2e/reports/` |
| OpenAPI spec | ✅ | `testing/openapi/encounter-openapi.yaml` |
| Generator reads spec → EP classes + 3-point BVA; API tests use it | ✅ | `generate_cases()`; tests GEN-004 and API-ENC-045/019/014 |
| Change 2 constraints, regenerate, show effect; **updated spec** | ✅ | `testing/openapi/encounter-openapi.v2.yaml` (limit 5→3, maxLength 100→12); effect: `testing/evidence/two-constraint-regeneration.json` (BVA 4/5/6→2/3/4, 99/100/101→11/12/13); GEN-005 |
| Mutation on the business-rule module, score | ✅ | `testing/evidence/mutation-analysis.md`: 65.1% → **92.8%** (mutmut 3.8.1); raw `testing/mutation/results/` |
| ≥2 custom mutation operators | ✅ | `testing/mutation/custom_operators.py` (3, all killed: `results/custom-mutant-results.json`) |
| ≥15 surviving mutants analysed, killable ones killed | ✅ | 146 analysed: `testing/mutation/results/survivor-analysis.md/.json` (116 killed, 17 equivalent, 13 DEF-19) |
| GitHub Actions on every PR: SonarQube, all tests, mutation | ✅ | `.github/workflows/care-quality-gate.yml` |
| Block merge/deploy below justified thresholds; no escape hatches | ⚠️ | Gates: coverage 100% on rule functions, mutation ≥ 80%, Sonar gate `testing/sonar/quality-gate.json` (justified in the Sonar report §3); deploy job needs all gates; no `continue-on-error` or OR-true. **Owner must enable branch protection on `main`** (PR #4 was merged red) |
| One documented fix PR (fails before, passes after) | ✅ | PR #5: run 46146842984 ❌ (Sonar, DEF-20) → 46148402745 ✅ (`docs/reports/test-completion-report.md` §6) |
| One PR the pipeline blocked | ⚠️ | Branch `sqe/demo-blocked-remove-tests`, run 46148457020 ❌ at the mutation gate. **Owner: open its PR (don't merge)** |
| Tools: pytest/coverage.py; SonarQube; mutmut; OpenAPI + own generator; Lighthouse + axe; Playwright + Actions | ✅ | All used as listed |
| Tools: Vitest for TypeScript | ⚠️ | Frontend rule tests use Node's built-in `node:test` runner (`testing/frontend/`). The rules under test are covered behaviourally by Playwright |

## Section 3 – Usability and accessibility

| Requirement | Status | Where |
|---|---|---|
| 2 Playwright tests (one per workflow): open, complete, confirmation | ✅ | `testing/e2e/specs/encounter-e2e.spec.ts` |
| Rejected value → error explains fix → correct → success | ✅ | Same file, create test (BR-ENC-02 future start) |
| Keyboard navigation: focus order of required fields + submit, keyboard submit | ✅ | Same test; focus log attached to the Playwright report |
| Lighthouse (a11y, BP, SEO) on each key screen + full axe scan | ✅ | `testing/accessibility/before/`, `after/` (Lighthouse JSON/HTML, axe JSON/MD) |
| Issues counted once; element, impact, fix | ✅ | `testing/accessibility/issue-analysis.md` |
| Fix one screen, rerun both tools, compare | ✅ | `testing/accessibility/comparison.md` (Create dialog: axe 2→1, Lighthouse 94→99); patch `testing/accessibility/after/care_fe-create-encounter-fix.patch` |
| Scripts, Playwright report, before/after reports | ✅ | `testing/e2e/accessibility-run.js`, `accessibility-compare.js`, `verify-error-association.js`; `testing/e2e/reports/playwright-html/` |

## Section 4 – Defensive security assessment

| Requirement | Status | Where |
|---|---|---|
| Routes and data of both workflows; access matrix | ✅ | `testing/security/SECTION4-REPORT.md` §2–3 |
| ≥4 Playwright access decisions across 2 roles (allowed + denied), with role/action/expected/observed/evidence | ✅ | `testing/security/specs/authorization.spec.ts` (10 checks); results `testing/security/evidence/authorization-results.md` |
| OWASP ZAP passive during both workflows | ✅ | `testing/security/zap/` (run script, reports, `zap-analysis.md`) |
| Review ≥2 controls (cookies, role checks), corroborated by source | ✅ | `SECTION4-REPORT.md` §5; `testing/security/evidence/session-controls.json`, `logout-revocation.json` |
| Dependency audit, packages/versions, impact, correction | ✅ | `testing/security/dependency-audit/dependency-audit-summary.md` (pip-audit, npm audit) |

## Section 5 – Performance and recovery

| Requirement | Status | Where |
|---|---|---|
| Operation chosen; p95 + failure limits set **before** testing, justified | ✅ | `testing/performance/TARGETS.md` |
| k6 OSS: 1 VU and ≥5 VUs, each twice, ≥60 s after ramp, same build/machine/data | ✅ | `testing/performance/encounter-retrieve.js`, `run-load-tests.sh`; raw output `testing/performance/results/` |
| Per run: p95, req/s, failure %; compared with limits | ✅ | `testing/performance/README.md` §2 (all 4 runs pass) |
| Environment details and interpretation | ✅ | `testing/performance/README.md` §1–2 |
| Automated failure-and-recovery test (dependency down mid-write, verify, restore, retry, no duplicates) | ✅ | `testing/integration/test_failure_recovery.py` (REC-ENC-001); log `testing/performance/results/recovery-test-runs.log` |

## Owner actions still open (cannot be done from the repository)

1. **Enable branch protection** on `main`, requiring the three gate jobs.
2. **Open the PR** for `sqe/demo-blocked-remove-tests` (do not merge), then **merge PR #5**.
3. **File the GitHub Issues:** `powershell -File docs/defects/create-issues.ps1` (needs `gh auth login`). Then record the issue numbers in the register.
4. **Enter actual hours** in `docs/test-estimation.md` to complete the variance.
