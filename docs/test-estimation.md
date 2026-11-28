# CARE Encounter Management - Test Effort Estimation

## 1. Estimation Basis

Effort is estimated in person-hours for an individual student project. The estimate covers the two selected workflows:

1. Create Patient Encounter.
2. Complete Patient Encounter.

The estimates follow the test scope in [test-plan.md](./test-plan.md), the source and upstream test evidence in [test-basis.md](./test-basis.md), the verified business rules in [business-rules.md](./business-rules.md), and the functional requirements in `../requirements/functional-requirements.md`.

The PERT formula used is:

**E = (O + 4M + P) / 6**

- **O**: Optimistic effort.
- **M**: Most likely effort.
- **P**: Pessimistic effort.
- **E**: PERT expected effort.
- **Actual effort**: Left as `Pending` because work has not yet been reported as completed.
- **Variance**: Left as `Pending` because actual effort is not available.
- **Status**: `Pending` until implementation and execution begin.

## 2. Activity Estimates

| Activity | O (hours) | M (hours) | P (hours) | PERT E (hours) | Estimated effort | Actual effort | Variance | Status |
|---|---:|---:|---:|---:|---:|---|---|---|
| Unit test design and implementation | 6 | 10 | 18 | 10.67 | 10.67 hours | *author to record* | *after actuals* | Done |
| API and integration test design and implementation | 8 | 14 | 24 | 14.67 | 14.67 hours | *author to record* | *after actuals* | Done |
| Browser Playwright E2E test implementation | 7 | 12 | 22 | 12.83 | 12.83 hours | *author to record* | *after actuals* | Done |
| Test data and fixture generation | 4 | 7 | 13 | 7.50 | 7.50 hours | *author to record* | *after actuals* | Done |
| Mutation testing setup and execution | 5 | 9 | 16 | 9.50 | 9.50 hours | *author to record* | *after actuals* | Done |
| CI/CD workflow and quality-gate setup | 5 | 8 | 15 | 8.67 | 8.67 hours | *author to record* | *after actuals* | Done |
| Defect investigation and analysis | 4 | 8 | 15 | 8.50 | 8.50 hours | *author to record* | *after actuals* | Done |
| Test execution and reporting | 5 | 9 | 16 | 9.50 | 9.50 hours | *author to record* | *after actuals* | Done |
| **Total** | **44** | **77** | **139** | **82.33** | **82.33 hours** | ***author to record*** | ***after actuals*** | **Done (28 Nov 2026)** |

## 3. PERT Calculations

### Unit testing

`E = (6 + 4 × 10 + 18) / 6 = 64 / 6 = 10.67 hours`

### API and integration testing

`E = (8 + 4 × 14 + 24) / 6 = 88 / 6 = 14.67 hours`

### Browser E2E testing

`E = (7 + 4 × 12 + 22) / 6 = 77 / 6 = 12.83 hours`

### Test data generation

`E = (4 + 4 × 7 + 13) / 6 = 45 / 6 = 7.50 hours`

### Mutation testing

`E = (5 + 4 × 9 + 16) / 6 = 57 / 6 = 9.50 hours`

### CI/CD

`E = (5 + 4 × 8 + 15) / 6 = 52 / 6 = 8.67 hours`

### Defect analysis

`E = (4 + 4 × 8 + 15) / 6 = 51 / 6 = 8.50 hours`

### Reporting

`E = (5 + 4 × 9 + 16) / 6 = 57 / 6 = 9.50 hours`

The PERT total is approximately **82.33 person-hours**. This is a planning estimate for one student and does not include unrelated CARE modules or production deployment.

## 4. Activity Scope

- **Unit testing:** Django unit tests for the active encounter limit, patient and facility validation, status-history behavior and encounter update logic.
- **API/integration testing:** `POST`, `GET` and `PUT` encounter requests, negative authorization cases, persistence checks and the restart endpoint.
- **Browser E2E testing:** Encounter creation, patient selection, field validation, encounter detail navigation and completion/discharge flows in Chromium.
- **Test data generation:** Synthetic patients, facilities, roles, encounter statuses, boundary encounter counts and restart-age scenarios.
- **Mutation testing:** Mutants targeting selected encounter validation and status-completion logic.
- **CI/CD:** GitHub Actions test execution, coverage and quality checks consistent with the test plan.
- **Defect analysis:** Defect reproduction, severity, root-cause analysis and traceability.
- **Reporting:** Test results, coverage, mutation score, defect summary and final completion evidence.

## 5. Estimate Assumptions

- The environment can use the documented Docker backend and Playwright frontend setup.
- Backend unit and API test work uses the existing Django test framework and CARE test helpers.
- Browser testing initially targets Chromium.
- The active encounter limit uses the documented default of `5`, while restart-age tests use an explicitly configured test value.
- Estimates assume that a student can investigate setup failures and small application defects as part of testing, but they do not include major application reimplementation.
- Actual effort and variance must be completed later from execution records only.

## 6. Comparison with Actual Effort (end of project)

All eight activities were completed by 28 Nov 2026. **Actual hours** must be entered by the author from their own time records. They can't be derived from git history or tool logs, so they are not estimated here.

**Variance:** Actual − PERT E (positive means over the estimate).

Scope changes that are known, with evidence, to have **increased** effort beyond the estimate:

| Activity | Estimate assumption | What actually happened | Evidence |
|---|---|---|---|
| Mutation testing | One working campaign | 4 harness defects (no score, then false verdicts), root-caused and fixed; 3 full re-runs; 146 survivors analysed; 16 tests added | `testing/evidence/mutation-analysis.md` §2–3; RCA-3 |
| Browser E2E | 2 workflow tests | 10 use-case flows (2 main + 4 alternative + 4 exception) | `testing/e2e/specs/use-cases.spec.ts` |
| CI/CD | Existing workflow | SonarQube moved into CI; fresh-DB seeding; frontend pinned to baseline; patch application | `.github/workflows/care-quality-gate.yml` |
| Defect analysis | Estimate covered RCA only | 20 defects, 3 RCAs, Pareto, 20 GitHub issue bodies | `docs/defects/` |

These are qualitative signals of over-run. Record the measured variance in the table above once the actual hours are entered.
