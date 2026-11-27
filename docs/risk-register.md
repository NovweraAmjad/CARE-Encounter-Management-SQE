# CARE Encounter Management - Risk Register

## 1. Purpose and Basis

This risk register identifies product and project risks for testing the selected CARE Encounter Management workflows:

1. Create Patient Encounter.
2. Complete Patient Encounter.

The register is based on [test-plan.md](./test-plan.md), [test-basis.md](./test-basis.md), [business-rules.md](./business-rules.md) and `../requirements/functional-requirements.md`.

The risks below describe potential failures or project obstacles. They are not evidence that an incident or defect has occurred. Mitigation entries describe planned controls unless existing source or test evidence is explicitly mentioned.

## 2. Risk Scoring

For each risk:

**Risk score = Likelihood (1–5) × Impact (1–5)**

| Score band | Risk level | Testing response |
|---|---|---|
| 1–4 | Low | Basic functional, smoke and regression testing. |
| 5–9 | Medium | Functional and integration testing, equivalence partitioning and selected boundary tests. |
| 10–15 | High | Extensive unit, branch, API, negative, boundary and end-to-end testing. |
| 16–25 | Critical | Highest priority: comprehensive unit/API/E2E coverage, negative and decision-table testing, immediate escalation and no unresolved risk at the exit gate. |

Likelihood meanings:

| Score | Meaning |
|---|---|
| 1 | Rare |
| 2 | Unlikely |
| 3 | Possible |
| 4 | Likely |
| 5 | Almost certain |

Impact meanings:

| Score | Meaning |
|---|---|
| 1 | Negligible effect on assignment evidence |
| 2 | Minor local UI or test-data effect |
| 3 | Moderate workflow or reporting effect |
| 4 | Major workflow or data-integrity effect |
| 5 | Severe security, clinical-workflow or unrecoverable test-data effect |

## 3. 5×5 Likelihood-Impact Matrix

Rows are likelihood; columns are impact. Risk IDs show risks initially assessed at that position.

| Likelihood \ Impact | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | – | – | – | – | – |
| **4** | – | – | PR-07 | PR-08, PJ-02 | – |
| **3** | – | PR-09 | PR-01, PR-03, PR-10, PJ-01 | PR-02, PR-04, PR-06 | PR-05 |
| **2** | – | – | – | – | – |
| **1** | – | – | – | – | – |

The matrix is an assessment aid. The detailed register below is authoritative for each score.

## 4. Product Risks

| ID | Description | Category | Likelihood | Impact | Score | Risk level | Mitigation | Contingency | Owner | Residual risk |
|---|---|---|---:|---:|---:|---|---|---|---|---|
| PR-01 | Active encounter limits may be exceeded because the backend counts active statuses incorrectly or uses the wrong patient-facility scope. Relevant rule: BR-ENC-01; requirements: FR-ENC-02. | Business logic / boundary | 3 | 3 | 9 | Medium | Test 4, 5 and 6 active encounters, terminal statuses, separate facility scopes and the configured setting. Existing upstream evidence includes `test_validate_data_max_encounters`. | Stop boundary testing at the scoped workflow, isolate the count data and report the exact count/query mismatch. | Test Engineer / Project Author | Medium until boundary tests execute; limit count and scope remain key verification points. |
| PR-02 | Creation may accept nonexistent or mismatched patient or facility references, allowing an encounter to be attached to invalid records. Relevant rule: BR-ENC-01; requirements: FR-ENC-01 and FR-ENC-02. | Validation / data integrity | 3 | 4 | 12 | High | Test random valid UUIDs, nonexistent UUIDs and patient/facility combinations that do not match. Existing upstream tests cover missing patient and facility IDs in `test_encounter_api.py`. | Reject the case as a blocking defect if a request persists an invalid relationship; restore synthetic data and rerun retrieval checks. | Test Engineer / Project Author | High until API tests verify both negative cases. |
| PR-03 | Creation may accept invalid enum values, invalid organization selections or future dates in a non-planned status. Relevant rule: BR-ENC-02; requirements: FR-ENC-03. | Input validation | 3 | 3 | 9 | Medium | Use equivalence partitions and boundary values for status, encounter class, priority, date and organization. Preserve the source boundary that backend future-date validation was not verified. | Separate frontend-form evidence from backend API evidence and add a targeted API case for any assumed backend rule. | Test Engineer / Project Author | Medium until frontend and API behavior are verified independently. |
| PR-04 | Encounter status changes may be accepted in undefined combinations or status history may record duplicate, missing or incorrect entries. Relevant rule: BR-ENC-03; requirements: FR-ENC-06. | State transition / audit data | 3 | 4 | 12 | High | Test every implemented status enum and same-status versus changed-status updates. Verify one initial history entry on create and append behavior on update. Document that no central backend transition allowlist was identified. | If arbitrary transitions are observed, test only enum persistence and status-history correctness unless a formal transition matrix is supplied. | Test Analyst / Project Author | High until status-history and supported values are executed. |
| PR-05 | An inpatient encounter may be completed or bypass the discharge questionnaire when the encounter class/status Boolean condition is evaluated incorrectly. Relevant rule: BR-ENC-04; requirements: FR-ENC-07 and FR-ENC-09. | Workflow / clinical decision | 3 | 5 | 15 | High | Build a four-row decision table for inpatient/non-inpatient crossed with discharged/non-discharged. Add browser and route assertions for `toDischarge=true`. | Stop the completion flow from progressing; restore the encounter fixture and verify direct-update and discharge-route branches separately. | Test Engineer / Project Author | High until browser and route behavior are verified. |
| PR-06 | Completion may set an incorrect period end or fail to preserve the existing start/end values. Relevant rule: BR-ENC-05; requirements: FR-ENC-08. | Data consistency | 3 | 4 | 12 | High | Test encounters with no end, an existing end and the direct completion payload. Assert the outgoing period and stored backend representation. | Compare the request body with stored state and use a fresh synthetic encounter to isolate period corruption. | Test Engineer / Project Author | High until request and persistence assertions execute. |
| PR-07 | Completing an encounter associated with an appointment or token may leave optional related records inconsistent if closing logic fails. | Integration / data consistency | 4 | 3 | 12 | High | Test `completeEverything` with no appointment, active appointment, final appointment, active token and final token combinations. Verify updates occur only according to the source conditions. | Complete only the Encounter update branch; report related-record inconsistency separately and do not assume the backend automatically closes unrelated records. | Test Engineer / Project Author | High until batch behavior and optional relations are tested. |
| PR-08 | Unauthorized users may create or complete encounters, expose patient/clinical data or perform restart actions. Relevant rules: BR-ENC-03 and BR-ENC-06; requirements: FR-ENC-01, FR-ENC-09 and FR-ENC-10. | Security / authorization | 4 | 4 | 16 | Critical | Test authenticated and unauthenticated roles across create, retrieve, update and restart endpoints. Existing upstream tests cover creation, retrieval and update permission negatives. | Revoke test credentials, isolate fixtures and rerun negative API calls against the baseline. Escalate unresolved authorization defects before broader testing. | QA Reviewer / Project Author | Critical until role and endpoint negatives execute and pass evidence is recorded. |
| PR-09 | Existing upstream tests may leave gaps between backend behavior and the browser completion workflow. | Test coverage / traceability | 3 | 2 | 6 | Medium | Trace every functional requirement to unit, API or Playwright evidence. The test basis notes that no dedicated upstream browser test covers every completion-dialog step. | Prioritize API and route-level tests, then add a focused browser smoke test before regression expansion. | Test Analyst / Project Author | Medium while E2E completion coverage remains to be implemented. |
| PR-10 | Concurrency or duplicate requests may create repeated active encounters or inconsistent status-history and period updates. Relevant rule: BR-ENC-01 and BR-ENC-03; requirements: FR-ENC-02 and FR-ENC-06. | Concurrency / data integrity | 3 | 3 | 9 | Medium | Repeat creation and completion requests against isolated fixture records. Verify unique persisted effects and status-history expectations. | Restore or reset synthetic test data before each repetition and retain request/response evidence for defect reproduction. | Test Engineer / Project Author | Medium until concurrency behavior is tested or explicitly deferred. |

## 5. Project Risks

| ID | Description | Category | Likelihood | Impact | Score | Risk level | Mitigation | Contingency | Owner | Residual risk |
|---|---|---|---:|---:|---:|---|---|---|---|---|
| PJ-01 | Docker, PostgreSQL, Redis, Node.js or Playwright setup failures may prevent backend or browser tests from starting. | Environment / tooling | 3 | 3 | 9 | Medium | Follow the documented local setup, verify ports and dependencies, and keep backend/frontend baseline versions fixed. Use synthetic fixture snapshots for repeatable setup. | Run backend unit/API tests if browser setup fails; document the blocked browser scope and restore services before resuming. | Project Author | Medium until environment readiness is demonstrated. |
| PJ-02 | Schedule pressure may leave mutation testing, CI quality gates or final regression evidence incomplete. | Schedule / deliverables | 4 | 4 | 16 | Critical | Prioritize requirements and High/Critical product risks first, then automation coverage, mutation testing and reporting. Track progress against the test plan phases. | Reduce optional regression breadth, preserve direct API/E2E evidence for the two workflows and document the deferred scope explicitly. | Project Coordinator / Project Author | Critical until a milestone schedule and completed evidence exist. |

## 6. How Risk Levels Determine Testing Depth

### Low risks: score 1–4

- Use basic functional, smoke and regression checks.
- No additional mutation or concurrency campaign is normally required.

### Medium risks: score 5–9

- Use equivalence partitioning and selected boundary values.
- Add focused API assertions and representative browser flows.
- Include regression checks after fixes.

### High risks: score 10–15

- Use extensive unit and branch tests.
- Use negative API tests, boundary values and decision tables.
- Use one or more Playwright flows for the affected workflow.
- Require persistence and authorization evidence.

### Critical risks: score 16–25

- Apply the highest testing priority.
- Use all relevant unit, API, negative, boundary and end-to-end techniques.
- Escalate unresolved defects promptly.
- Do not mark the affected exit criterion complete until approved evidence exists.

## 7. Risk Monitoring

The initial scores should be reviewed after the test environment is ready and after the first test implementation cycle. A score may be reduced only when evidence exists, such as executed tests, traceability results or approved disposition records. No score in this register represents a defect result or a mitigated risk until that evidence is recorded.
