# CARE Encounter Management – Test Plan

## 1. Introduction

This test plan defines the strategy, scope, resources, schedule, environment, risks and completion criteria for testing the CARE Encounter Management system. The objective is to evaluate the correctness, reliability, security and usability of the selected encounter-management workflows.

The test plan is based on the functional requirements, business rules and test basis documented in this project.

## 2. Test Objectives

- Verify that encounter-management functional requirements are correctly implemented.
- Validate all selected encounter business rules documented in `docs/business-rules.md`.
- Detect defects in backend business logic, API behaviour and frontend workflows.
- Verify valid, invalid, boundary and exceptional inputs.
- Evaluate encounter status transitions and data consistency.
- Measure code coverage and assess code quality using SonarQube.
- Automate repeatable tests and integrate quality checks into CI.

## 3. Scope

### 3.1 In Scope

- Encounter creation and validation.
- Maximum active encounters per patient per facility.
- Patient and facility existence validation.
- Encounter status changes and status history.
- Inpatient discharge and completion workflows.
- Encounter completion and restart eligibility.
- Backend unit tests.
- API and integration tests.
- Browser end-to-end tests using Playwright.
- Static analysis, coverage and mutation testing.
- Test data generation and CI quality gates.

### 3.2 Out of Scope

- Testing unrelated CARE modules that do not affect the selected workflows.
- Full production deployment and live patient-data testing.
- External integrations not required by the selected requirements.
- Testing the complete CARE platform as a whole.

## 4. Test Approach

A risk-based testing approach will be followed. Testing depth and techniques will depend on the likelihood and impact of failure.

| Risk level | Testing approach |
|---|---|
| High | Extensive unit, branch, API, boundary, negative and end-to-end testing. |
| Medium | Functional, integration, equivalence partitioning and selected boundary tests. |
| Low | Basic functional, regression and smoke testing. |

The following test levels will be performed:

- **Unit testing:** Validate individual backend business-rule functions, including statement and branch coverage.
- **API and integration testing:** Validate request inputs, response codes, validation errors, persistence and interactions between components.
- **Browser end-to-end testing:** Validate complete user workflows and their alternative and exception flows using Playwright.
- **Static analysis:** Analyse complexity, duplication, code smells, bugs, vulnerabilities and technical debt through SonarQube.
- **Mutation testing:** Evaluate whether the automated tests detect deliberately introduced changes in business logic.

## 5. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Test Engineer | Design test cases, implement automation and execute tests. |
| Test Analyst | Analyse requirements, identify risks and maintain traceability. |
| Developer | Investigate defects and implement corrective changes. |
| QA Reviewer | Review test evidence, coverage and quality-gate results. |
| Project Coordinator | Track progress, estimates, risks and completion status. |

For this individual assignment, these responsibilities are performed by the project author.

## 6. Test Environment

| Component | Environment / Tool |
|---|---|
| Operating system | Windows 11 |
| Backend | CARE Django application |
| Frontend | CARE frontend application |
| Backend test framework | pytest / Django test framework |
| Frontend test framework | Playwright |
| Browser | Chromium |
| Static analysis | SonarQube Community Build |
| Version control | Git and GitHub |
| CI/CD | GitHub Actions |
| Container environment | Docker Desktop |
| API testing | Python Requests / pytest |

The backend and frontend source repositories will be checked out at their documented baseline commits during CI execution.

## 7. Test Data

Test data will be generated using controlled, non-production records.

The dataset will include:

- Existing and non-existing patients.
- Existing and non-existing facilities.
- Patients with active encounter counts below, at and above the configured maximum.
- Encounters in different statuses.
- Inpatient and non-inpatient encounters.
- Valid and invalid dates.
- Completed encounters within and outside the restart eligibility period.
- Repeated requests to check duplicate creation and data consistency.

No real patient-identifiable production data will be used.

## 8. Test Schedule

| Phase | Planned activity |
|---|---|
| Phase 1 | Test planning, requirements analysis and risk identification |
| Phase 2 | Unit test design and implementation |
| Phase 3 | API and integration test implementation |
| Phase 4 | Browser end-to-end automation |
| Phase 5 | Test data generator and OpenAPI specification |
| Phase 6 | Mutation testing and defect analysis |
| Phase 7 | CI quality-gate configuration |
| Phase 8 | Regression testing and final reporting |

Actual dates and effort will be recorded as work progresses.

## 9. Entry Criteria

Testing may begin when:

1. Functional requirements and business rules are documented.
2. Relevant backend and frontend source code is available.
3. The test environment and required dependencies are configured.
4. Test data and expected outcomes are defined.
5. The relevant test cases have been reviewed.

## 10. Exit Criteria

Testing will be considered complete only when all of the following measurable criteria are satisfied. These values are planned completion thresholds, not achieved results.

1. **Functional requirement coverage:** 100% of FR-ENC-01 through FR-ENC-10 have at least one executed unit, API/integration or browser test and a complete entry in `docs/traceability-matrix.md`. Planned tests recorded in the matrix are not sufficient; each test must have a recorded pass/fail execution result.
2. **Critical security gate — PR-08:** 100% of planned unauthenticated and unauthorized create, retrieve, update and restart API tests must pass. No HTTP 200/201/204 success response may occur for an unauthorized role where the corresponding endpoint is expected to return 403. All security failures must have either a closed defect or an approved disposition.
3. **Project completion gate — PJ-02:** The CI workflow must execute the planned backend unit/API suite and Chromium browser suite, publish 100% of required artifacts, and complete a final regression run. No unresolved schedule or environment blocker may remain; any deferred test scope must be documented in the final report.
4. **High-risk discharge gate — PR-05:** All four inpatient/non-inpatient and discharged/non-discharged decision-table combinations must produce the expected direct-completion or discharge-questionnaire route. For inpatient/non-discharged encounters, no encounter update setting status to `completed` may occur before the discharge step is completed.
5. **Creation boundary gate — PR-01:** The configured active encounter limit must pass 4-active, 5-active and 6-active boundary cases for the same patient/facility. Creation at 5 or below must follow the implemented behavior, and the case that reaches 6 active encounters must be rejected. Completed, cancelled, entered-in-error and discontinued records must not increase the active count.
6. **Status and period consistency:** All planned status-history assertions must pass: create adds the initial status entry, changed status appends an entry, and unchanged status does not add a duplicate entry. Completion period tests must confirm `period.start` preservation and `period.end` behavior for both missing-end and existing-end records.
7. **Backend coverage:** Branch coverage for the selected encounter validation and completion logic must reach at least 100%, or each uncovered branch must be named in a coverage report with a written reason; this criterion applies to statements and branches introduced or exercised by FR-ENC-01 through FR-ENC-10.
8. **API reliability:** At least 95% of planned API/integration cases must pass across a minimum of three consecutive runs. One repeat run may be used to isolate an environment problem, but no known intermittent data-integrity or authorization failure may remain.
9. **Browser reliability and performance:** At least 95% of planned Chromium Playwright workflow cases must pass across a minimum of three consecutive runs. Each successful create and completion browser flow must complete within 10 seconds in the local Docker/Vite environment, excluding the test framework's first-page cold start if the baseline run document records it.
10. **Defect and quality gate:** No unresolved Critical or High-severity defect may remain. Medium and Low defects require an approved disposition. The CI quality gate must report coverage, mutation-testing, static-analysis and test-execution evidence, even if a tool is unavailable and the limitation is explicitly recorded.

## 11. Suspension Criteria

Testing may be suspended when:

- The application or test environment becomes unavailable.
- A critical setup or configuration failure prevents reliable execution.
- Required test data is missing or corrupted.
- A major blocking defect prevents further testing of the affected workflow.

## 12. Resumption Criteria

Testing may resume when:

- The environment has been restored and verified.
- Blocking defects have been corrected or an approved workaround exists.
- Required test data has been restored.
- Smoke tests confirm that the affected workflows are executable.

## 13. Risk Management

Risks will be documented in a separate risk register. Each risk will be assessed using likelihood and impact scores from 1 to 5.

Risk score = Likelihood × Impact.

High-risk items will receive more extensive testing, including negative testing, boundary analysis, decision tables and regression testing. Risk levels, mitigation actions and residual risks will be reviewed throughout the project.

## 14. Test Monitoring and Reporting

Test progress will be monitored against the planned schedule and effort estimates.

The following measures will be tracked:

- Requirements coverage.
- Defect density.
- Defect severity and status.
- Defect reopen rate.
- Test execution and pass rates.
- Statement and branch coverage.
- Mutation score.
- SonarQube quality-gate status.

Weekly progress reports and a final test completion report will document results, deviations, unresolved defects and residual risks.

## 15. Test Deliverables

- Test plan.
- Risk register and risk matrix.
- Three-point effort estimation.
- Requirements traceability matrix.
- Unit, API, integration and browser test cases.
- Automated test data generator and OpenAPI specification.
- Coverage and mutation-testing reports.
- GitHub Issues and root cause analyses.
- CI/CD workflow and quality-gate evidence.
- Weekly progress reports.
- Final test completion report.