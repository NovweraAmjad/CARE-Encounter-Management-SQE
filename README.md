# CARE Encounter Management – Software Quality Engineering (SE3002)

**Public repository:** https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE

This is a test-engineering project on two workflows of the open-source CARE EMR: **Create Patient Encounter** and **Complete Patient Encounter**.

**Where to start:**
- [`docs/AUDIT-INDEX.md`](docs/AUDIT-INDEX.md) maps every assignment requirement to its evidence.
- The overall result is in [`docs/reports/test-completion-report.md`](docs/reports/test-completion-report.md).

## 1. System under test (upstream reference and baseline)

| | Upstream | Baseline commit | Licence |
|---|---|---|---|
| Backend (Django REST API, PostgreSQL) | https://github.com/ohcnetwork/care | `ddfd840dbe314b4e53d2a719d2138324d970634b` | MIT |
| Frontend (React + Vite) | https://github.com/ohcnetwork/care_fe | `5e02f9aa4f690e08375da310511e14606985f788` | MIT |

The upstream code is **not vendored**:
- `care/` and `care_fe/` are git-ignored local checkouts of those exact commits.
- CI checks them out at the same commits (`CARE_BACKEND_REF` / `CARE_FRONTEND_REF` in the workflow).
- This repository contains only tests, evidence, documentation and two small fix patches.

Details: [`docs/repository-selection.md`](docs/repository-selection.md), [`baseline.md`](baseline.md).

## 2. Reproducible setup

Prerequisites: Git, Docker + Docker Compose, Node 24, Python 3.12+ (for the helper scripts), Java 17+ (OWASP ZAP only), k6 OSS (Section 5 only).

```bash
git clone https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE.git && cd CARE-Encounter-Management-SQE

# 1. Upstream code at the baseline commits
git clone https://github.com/ohcnetwork/care.git    && git -C care    checkout --detach ddfd840dbe314b4e53d2a719d2138324d970634b
git clone https://github.com/ohcnetwork/care_fe.git && git -C care_fe checkout --detach 5e02f9aa4f690e08375da310511e14606985f788

# 2. Apply the project's two documented fixes (as CI does)
git -C care_fe apply ../testing/accessibility/after/care_fe-create-encounter-fix.patch   # DEF-04
git -C care_fe apply ../testing/sonar/care_fe-floating-promises-fix.patch                # DEF-20

# 3. Backend + synthetic seed data
docker compose -f care/docker-compose.yaml -f care/docker-compose.local.yaml up -d --build --wait
docker compose -f care/docker-compose.yaml -f care/docker-compose.local.yaml exec backend python manage.py load_fixtures

# 4. Frontend on http://localhost:4000
cd care_fe && echo "REACT_CARE_API_URL=http://127.0.0.1:9000" > .env.local && npm ci && npm run local
```

### Reset between runs

- **Backend unit/integration tests** create and roll back their own data in each test transaction, so no reset is needed.
- **Browser, security and k6 tests** restore their own preconditions (each test cancels or creates the open encounters it needs).
- **To restore the seeded database itself:** use the snapshot/restore helpers, with `POSTGRES_PORT=5433` for the Docker mapping:
  ```bash
  cd care_fe && npm run playwright:db-snapshot   # once, right after load_fixtures
  cd care_fe && npm run playwright:db-restore    # before a run
  ```
  Full details are in [`docs/repository-selection.md`](docs/repository-selection.md#resetting-test-data-between-runs).

## 3. Runnable scripts and test data

| What | Command (from the repository root unless noted) | Code |
|---|---|---|
| Backend unit + API/integration + generator tests (74) | `docker cp testing/. care-backend-1:/tmp/care_testing/` then `docker exec care-backend-1 bash -lc 'cd /app && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.unit care_testing.integration care_testing.generators --keepdb'` | `testing/unit`, `testing/integration`, `testing/generators` |
| Coverage + business-rule gate | see `testing/README.md`, then `python testing/mutation/coverage_quality_gate.py` | `testing/coverage/` |
| Mutation campaign (mutmut + 3 custom operators) + gate | `testing/mutation/campaign.py` (the exact command is in the workflow), then `python testing/mutation/quality_gate.py` | `testing/mutation/` |
| Frontend rule tests | `cd care_fe && node --import tsx --test ../testing/frontend/test_encounter_frontend_rules.ts` | `testing/frontend/` |
| Browser use cases (10 flows) | `cd testing/e2e && npm ci && npx playwright test --project=chromium` | `testing/e2e/` |
| Accessibility (Lighthouse + axe, before/after) | `cd testing/e2e && node accessibility-run.js before` (and `after`), then `node accessibility-compare.js` | `testing/accessibility/` |
| Security role checks | `cd testing/security && npm ci && npx playwright test --config=playwright.security.config.ts` | `testing/security/` |
| OWASP ZAP passive scan | `cd testing/security && node zap/run-zap-passive.js` (needs `ZAP_HOME`) | `testing/security/zap/` |
| Dependency audit | see `testing/security/README.md` | `testing/security/dependency-audit/` |
| SonarQube scan + quality gate | `SONAR_HOST_URL=http://localhost:9000 bash testing/sonar/sonar-gate.sh` | `testing/sonar/` |
| k6 load tests | `bash testing/performance/run-load-tests.sh` | `testing/performance/` |
| Test data | synthetic fixtures + generated EP/BVA cases | [`test-data/`](test-data/README.md), `testing/openapi/` |

## 4. Tool versions (as measured on 28 Nov 2026)

| Tool | Version | | Tool | Version |
|---|---|---|---|---|
| Python (backend container) | 3.13.18 | | Node.js | 24.18.0 |
| Django | 6.0 | | Playwright (Chromium) | 1.65.1 |
| PostgreSQL | 17.12 | | Lighthouse | 13.6.0 |
| coverage.py | 7.13.0 | | axe-core / @axe-core/playwright | 4.14.1 |
| pytest | 9.2.0 | | OWASP ZAP | 2.17.0 |
| mutmut | 3.8.1 | | pip-audit | 2.10.1 |
| SonarQube | 26.11.0.134175 (Community) | | @sonar/scan | 4.4.0 |
| k6 OSS | 2.2.0 | | Docker | 29.7.2 |

## 5. CI configuration

[`.github/workflows/care-quality-gate.yml`](.github/workflows/care-quality-gate.yml) runs on every pull request to `main`/`develop`. Three gate jobs, plus a deploy job that needs all of them:

1. **Python tests, coverage and mutation:**
   - unit, integration and generator tests;
   - 100% statement/branch coverage gate on the business-rule functions;
   - mutmut + custom operators;
   - mutation gate ≥ 80%.
2. **Frontend rules, Playwright E2E and security checks:** frontend rule tests, the 10 use-case flows, the 12 role/session checks, and Lighthouse.
3. **SonarQube quality gate:**
   - a fresh SonarQube service with the custom gate [`testing/sonar/quality-gate.json`](testing/sonar/quality-gate.json): reliability, security and maintainability all A, duplication ≤ 3%, coverage ≥ 75%;
   - thresholds justified in [`docs/reports/sonarqube-analysis.md`](docs/reports/sonarqube-analysis.md).
4. **Deploy verified evidence:** runs only on `main` and needs all three gates.

There are no `continue-on-error` or OR-true escape hatches. Merge blocking is enforced by branch protection on `main`, with the three gate jobs as required checks.

## 6. Documented change through a pull request (fails before, passes after)

**PR #5** (https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE/pull/5) fixes **DEF-20**: 5 unhandled promises found by SonarQube.

| Run | Commit | Result |
|---|---|---|
| [46146842984](https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE/actions/runs/46146842984) | `216c488` | ❌ SonarQube quality gate fails: Reliability C, 5 × `typescript:S9383` |
| [46148402745](https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE/actions/runs/46148402745) | `f2730c0` | ✅ all gates pass after the fix (`testing/sonar/care_fe-floating-promises-fix.patch`) |

The defect is DEF-20 in [`docs/defects/defect-register.md`](docs/defects/defect-register.md). The local before/after scans are in `testing/sonar/results-before-fix/` and `results-after-fix/`.

## 7. Pull request blocked by the pipeline

**Branch `sqe/demo-blocked-remove-tests`** deletes 10 "redundant-looking" tests.
- All remaining tests and the coverage gate still pass.
- The **mutation gate fails** (the score falls below 80%), so the pipeline rejects it.
- Run: [46148457020](https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE/actions/runs/46148457020): ❌ at "Enforce mutation threshold".
- Pull request: https://github.com/NovweraAmjad/CARE-Encounter-Management-SQE/pulls?q=head%3Asqe%2Fdemo-blocked-remove-tests (**must not be merged**).

## 8. Repository layout

```
docs/                plan, risks, estimation, requirements basis, traceability, defects (RCA, Pareto, issues), reports
requirements/        functional requirements FR-ENC-01..10
test-data/           synthetic data description + generated EP/BVA cases
testing/unit|integration|generators|frontend   functional tests
testing/openapi/     OpenAPI spec (v1) and regenerated spec (v2)
testing/coverage/    coverage.py output, MCC/MC/DC, uncovered-code justification
testing/mutation/    mutmut campaign, custom operators, results, survivor analysis
testing/e2e/         Playwright use cases, accessibility scripts, reports
testing/accessibility/  Lighthouse + axe before/after
testing/security/    Section 4: role checks, ZAP, dependency audit, report
testing/sonar/       SonarQube gate, fix patch, before/after measures
testing/performance/ Section 5: k6 script, raw results, recovery-test log
.github/workflows/   CI quality gate
```
