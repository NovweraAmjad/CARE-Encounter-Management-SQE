# CARE Encounter Management - Requirements Traceability Matrix

## 1. Purpose

This matrix maps every functional requirement to its associated business rule, planned test scenario and test level. Test execution status is `Planned` until evidence is recorded. The IDs below are plan IDs and do not claim that test implementations or executions exist.

| Requirement ID | Requirement description | Business rule | Test scenario | Test case IDs | Test level | Expected result | Execution status |
|---|---|---|---|---|---|---|---|
| FR-ENC-01 | Create an encounter for a valid patient and facility as an authorized clinical user. | BR-ENC-01, BR-ENC-03 | Positive creation with required status, encounter class and priority; duplicate creation below and above the active limit. | `UNIT-ENC-001`, `UNIT-ENC-006`, `UNIT-ENC-009`, `UNIT-ENC-010`, `API-ENC-001`, `UPSTREAM-test_create_encounter_with_permissions`, `E2E-ENC-001` | Unit, API/integration, browser E2E | Encounter is persisted and linked to the selected patient and facility; the response contains the created encounter. | Partially executed: 31-test independent suite and upstream API suite passed; `E2E-ENC-001` Planned |
| FR-ENC-02 | Prevent creation at or beyond the configured active encounter limit for a patient/facility. | BR-ENC-01 | Boundary test with 4, 5 and 6 active encounters; terminal-status exclusions; same patient in another facility. | `UNIT-ENC-001`, `UNIT-ENC-002`, `UNIT-ENC-008`, `API-ENC-001`, `API-ENC-002`, `UPSTREAM-test_validate_data_max_encounters` | Unit, API/integration | Four or five active encounters remain valid according to the configured limit; the sixth active encounter is rejected. Completed, cancelled, entered-in-error and discontinued encounters are excluded. | Passed |
| FR-ENC-03 | Validate encounter status, class, priority and future start-date combinations. | BR-ENC-02, BR-ENC-03 | Valid enum partitions; invalid enum and organization values; planned future date; in-progress/on-hold future date. | `UNIT-ENC-014`, `UNIT-ENC-009`, `UNIT-ENC-012`, `UNIT-ENC-013`, `FE-ENC-002`, `E2E-ENC-002` | Unit, API/integration, frontend source contract, browser E2E | Valid values pass; invalid values and non-planned future starts are rejected or blocked. Frontend blocking and backend acceptance are verified independently. | Partially executed: Pydantic, status-history and frontend source-contract tests Passed; browser and full backend future-date cases Planned |
| FR-ENC-04 | Display, refresh and navigate to the created encounter. | BR-ENC-03 | Submit a valid browser encounter; verify success toast, sheet closure, list refresh and route to the Updates tab. | `E2E-ENC-003` | Browser E2E | UI shows success, refreshes patient encounters and navigates to `/facility/{facilityId}/patient/{patientId}/encounter/{encounterId}/updates`. | Planned |
| FR-ENC-05 | Retrieve encounter details as an authorized user. | BR-ENC-03 | Positive retrieval with valid patient/facility query parameters; negative retrieval by an unauthorized user; nonexistent encounter. | `UPSTREAM-test_retrieve_encounter_with_permissions`, `UPSTREAM-test_retrieve_encounter_without_permissions`, `E2E-ENC-004` | API/integration, browser E2E | Authorized retrieval returns 200 and complete representation; unauthorized retrieval returns 403. | Partially executed: upstream API tests Passed; `E2E-ENC-004` Planned |
| FR-ENC-06 | Mark an authorized eligible encounter as completed. | BR-ENC-03, BR-ENC-05 | Positive update to `completed`; same-status update; negative update without permission; verify persisted status and history. | `UNIT-ENC-012`, `UNIT-ENC-013`, `API-ENC-003`, `API-ENC-004`, `UPSTREAM-test_update_encounter_with_permissions`, `E2E-ENC-005` | Unit, API/integration, browser E2E | Encounter status becomes `completed`, history behavior follows BR-ENC-03 and unauthorized requests return 403. | Partially executed: unit status-history and upstream/API update tests Passed; browser E2E Planned |
| FR-ENC-07 | Route inpatient/non-discharged encounters through the discharge questionnaire. | BR-ENC-04 | Decision-table test for inpatient/non-inpatient crossed with discharged/non-discharged; browser route assertion. | `FE-ENC-001`, `E2E-ENC-006` | Frontend unit, browser E2E | Only inpatient encounters that are not discharged route to the encounter questionnaire with `toDischarge=true`; direct completion is used for the other rows. | Partially executed: `FE-ENC-001` Passed; browser case Planned |
| FR-ENC-08 | Set the completion period end while preserving period start. | BR-ENC-05 | Completion with no existing end; completion with an existing end; verify outgoing and persisted period fields. | `UNIT-ENC-015`-`UNIT-ENC-019`, `API-ENC-008`, `API-ENC-009`, `FE-ENC-003`, `E2E-ENC-007` | Unit, API/integration, frontend source contract, browser E2E | Existing start is preserved; existing end is unchanged; missing end remains unpopulated in the backend and frontend timestamp behavior is separately source-tested. | Partially executed: unit/API and frontend source-contract checks Passed; browser E2E Planned |
| FR-ENC-09 | Deny unauthorized encounter completion. | BR-ENC-03 | Unauthenticated request, role without update permission and cross-facility unauthorized update. | `UPSTREAM-test_update_encounter_without_permissions`, `E2E-ENC-008` | API/integration, browser E2E | Unauthorized requests return 403 and no status, period or history change is persisted. | Partially executed: upstream unauthorized update test Passed; browser E2E Planned |
| FR-ENC-10 | Restart only completed encounters within the configured restart window. | BR-ENC-06 | Completed within limit; exactly at limit; just outside; far outside; non-completed; unauthorized. | `API-ENC-005`, `API-ENC-010`, `API-ENC-011`, `API-ENC-012`, `UPSTREAM-test_restart_completed_encounter`, `UPSTREAM-test_restart_expired_encounter` | Unit, API/integration | Eligible completed encounter becomes `in_progress` and returns 204; non-completed, expired or unauthorized cases are rejected. | Passed for 31-test suite and restart subset coverage |

## 2. Coverage Summary

| Coverage category | Planned coverage |
|---|---|
| Positive cases | FR-ENC-01, FR-ENC-04, FR-ENC-05, FR-ENC-06 and FR-ENC-10 |
| Negative cases | FR-ENC-02, FR-ENC-03, FR-ENC-05, FR-ENC-09 and FR-ENC-10 |
| Boundary values | FR-ENC-02 uses 4/5/6 active encounters; FR-ENC-03 uses future-date partitions; FR-ENC-10 uses exact and just-outside restart-window boundaries |
| Unit coverage | FR-ENC-01, FR-ENC-02, FR-ENC-03, FR-ENC-06, FR-ENC-07, FR-ENC-08, FR-ENC-09 and FR-ENC-10 |
| API/integration coverage | Every functional requirement except where browser-only presentation is the direct output; FR-ENC-01 through FR-ENC-10 have API or backend-level planned cases |
| Browser E2E coverage | FR-ENC-01, FR-ENC-03, FR-ENC-04, FR-ENC-05, FR-ENC-06, FR-ENC-07, FR-ENC-08 and FR-ENC-09 |

## 3. Coverage Gaps

No current functional-requirement gap is identified in the matrix. Every FR-ENC-01 through FR-ENC-10 has at least one planned test level and test-case ID.

Additional implementation boundaries to verify rather than assumptions:

- The backend source reviewed in the test basis does not show the frontend-only future-start rule as a backend create rule.
- The source does not define a complete backend old-to-new encounter status-transition allowlist.
- `FR-ENC-10` is optional secondary restart behavior and has no browser test ID in this matrix unless browser restart coverage is added later.

## 4. API and integration execution status

The independent API/integration suite now includes additional executable IDs:

- `API-ENC-013` through `API-ENC-026`.
- `GEN-001` through `GEN-003`.

The latest independent unit/API/generator run passed 49 tests.
The 49-test evidence is recorded in
`testing/evidence/api-integration-results.md`.

The new execution results cover malformed/detail IDs, invalid enums,
hospitalization and identifier boundaries, organization duplicate/wrong-facility
behavior, appointment associations, dynamic active-limit boundaries,
naive/equal periods, repeated requests and state-transition behavior.

## 5. Mutation analysis status

| Artifact | Current status | Verified evidence |
|---|---|---|
| Standard mutmut campaign | Pending | No `mutmut-cicd-stats.json` or `mutmut-standard-run.json` exists. |
| Custom mutation campaign | Pending | Three custom operator records exist, but `executed=false` for all of them. |
| Survivor analysis | Shortfall remains | `surviving-mutants.json` records `0` actual survivors and `15` required analyses missing. |
| Mutation score | Not available | No measured killed/survived count supports a score. |

The independent unit and integration tests are traceable to the active-limit,
restart and status-history business rules. A future campaign must add actual
mutant IDs and test outcomes before those tests are described as mutation-killing.
