# CARE Encounter Management – Requirements Traceability Matrix

**Updated:** 28 Nov 2026.

Every test ID below exists in the repository and was executed on 28 Nov 2026. The execution status is the observed result, not a plan.

**Test sets:**

| Prefix | What | Where |
|---|---|---|
| `UNIT-ENC-*` | 18 unit tests | `testing/unit/` |
| `API-ENC-*` | 51 API/integration tests (incl. recovery REC-ENC-001) | `testing/integration/` |
| `GEN-*` | 5 generator tests | `testing/generators/` |
| `FE-ENC-*` | 3 frontend rule tests | `testing/frontend/` |
| `E2E-ENC-*` | 10 Playwright use-case flows | `testing/e2e/specs/` |
| `SEC-*` | 12 Playwright security checks | `testing/security/specs/` |
| `A11Y-001` | Lighthouse + axe audit | `testing/accessibility/` |

The full per-case list, with inputs, expected and actual results, is in `testing/evidence/test-case-register.csv`.

## 1. Matrix

| Requirement | Description | Business rule | Unit | API / integration | Browser E2E / other | Status |
|---|---|---|---|---|---|---|
| FR-ENC-01 | Create an encounter for a valid patient and facility as an authorized clinical user | BR-ENC-01, BR-ENC-03 | UNIT-ENC-001, 006, 009, 010 | API-ENC-001, 015, 016, 017, 020, 033, 034, 036, 039, 040 | E2E-ENC-001, 004; SEC-AC-05 | Passed |
| FR-ENC-02 | Prevent creation at or beyond the active-encounter limit | BR-ENC-01 | UNIT-ENC-001–004 | API-ENC-001, 002, 019, 033; GEN-002 | E2E-ENC-001, 006 | Passed |
| FR-ENC-03 | Validate status, class, priority and the future-start combination | BR-ENC-02, BR-ENC-03 | UNIT-ENC-014 | API-ENC-014, 021, 045 (all 28 generated valid classes); GEN-004/005 | E2E-ENC-001 (rejected value + correction), 003, 004, 005; FE-ENC-002 | Passed. **Defect DEF-03:** the API does not enforce BR-ENC-02 |
| FR-ENC-04 | Display, refresh and navigate to the created encounter | BR-ENC-03 | – | API-ENC-030, 041 (list/detail payload) | E2E-ENC-001, 003, 004 (toast + redirect); A11Y-001 | Passed |
| FR-ENC-05 | Retrieve encounter details as an authorized user | BR-ENC-03 | – | API-ENC-013, 027, 028, 029, 041 | SEC-AC-01, 02, 08, 09, 10 | Passed |
| FR-ENC-06 | Mark an eligible encounter completed | BR-ENC-03, BR-ENC-05 | UNIT-ENC-009–013 | API-ENC-003, 004, 018, 022, 035, 037, 043 (40 allowed transitions), 044 (disallowed from each state) | E2E-ENC-002, 008, 009; SEC-AC-06, 07 | Passed |
| FR-ENC-07 | Route inpatient, not-discharged encounters to the discharge questionnaire | BR-ENC-04 | FE-ENC-001 (4-row decision table) | – | E2E-ENC-007 | Passed |
| FR-ENC-08 | Set the completion end while preserving the start | BR-ENC-05 | UNIT-ENC-015–019 | API-ENC-008, 009, 023, 024 | E2E-ENC-008; FE-ENC-003 | Passed. **Defect DEF-02:** `hospitalization: null` → 500 |
| FR-ENC-09 | Deny unauthorized completion | BR-ENC-03 | – | API-ENC-012, 037 | E2E-ENC-010; SEC-AC-06, 10 | Passed |
| FR-ENC-10 | Restart only completed encounters within the window | BR-ENC-06 | – | API-ENC-005, 010, 011, 012, 025, 026 | – (API-only secondary flow) | Passed |

## 2. Requirements coverage (GQM metric)

| Measure | Value |
|---|---|
| Requirements with at least one **executed, passing** test | **10 / 10 = 100%** |
| Requirements covered at ≥2 test levels | 9 / 10 (FR-ENC-10 is API-only) |
| Requirements with an open defect against them | 3 (FR-ENC-03 → DEF-03; FR-ENC-08 → DEF-02; FR-ENC-01 → DEF-01) |

## 3. Business-rule coverage

| Rule | Unit (statement/branch) | MCC / MC/DC | API | Browser | Mutation |
|---|---|---|---|---|---|
| BR-ENC-01 active limit | 100% / 100% (`validate_data`) | Complete MCC + MC/DC pairs (`testing/coverage/mcc-mcdc.md`) | BVA 0/4/5/6 and dynamic limit | E2E-ENC-001, 006 | mutmut + custom operator `BR01_ACTIVE_LIMIT_COMPARISON` |
| BR-ENC-02 future start | Frontend rule (no server code: DEF-03) | 3×2 decision table | API shows it is accepted (DEF-03) | E2E-ENC-001, 003 | n/a (frontend) |
| BR-ENC-03 status history | 100% / 100% (create and update specs) | Changed/unchanged pairs | API-ENC-003, 004, 022, 035 | E2E-ENC-002 | mutmut + custom `BR03_STATUS_HISTORY_CHANGE` |
| BR-ENC-04 discharge route | FE-ENC-001 truth table | 4-row decision table | n/a (frontend) | E2E-ENC-007 | n/a (frontend) |
| BR-ENC-05 completion period | 100% / 100% (`validate_period`, `perform_update`) | Naive/order rows | API-ENC-008, 009, 023, 024 | E2E-ENC-008 | mutmut (`perform_update`) |
| BR-ENC-06 restart | 100% / 100% (`restart`) | 3-condition table | API-ENC-005, 010–012, 025, 026 | – | custom `BR06_RESTART_ELAPSED_TIME` (mutmut 3 skips decorated functions) |

Mutation results and survivor analysis: `testing/evidence/mutation-analysis.md`.
