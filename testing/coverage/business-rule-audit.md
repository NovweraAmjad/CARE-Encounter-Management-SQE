# Server-Side Business Rule Coverage Audit

**Source:** coverage.py 7.13.0, branch coverage on, 74 backend tests (`coverage-report.txt`, `coverage.json`, `coverage.xml`).

**Updated:** 28 Nov 2026.

**Gate:** `testing/mutation/coverage_quality_gate.py` → **PASS**: every selected business-rule function has 100% statement and branch coverage. The same gate runs in CI.

## 1. Business-rule functions: 100% statement and branch

| Rule | Function | Statements | Branches | MCC / MC/DC |
|---|---|---|---|---|
| BR-ENC-01 active limit | `EncounterViewSet.validate_data` | 8/8 | 8/8 | Complete MCC + MC/DC pairs (`mcc-mcdc.md`) |
| BR-ENC-03 status history (create) | `EncounterCreateSpec.perform_extra_deserialization` | 7/7 | 4/4 | Simple/appointment branches |
| BR-ENC-03 status history (update) | `EncounterUpdateSpec.perform_extra_deserialization` | 5/5 | 4/4 | Changed/unchanged pairs |
| BR-ENC-05 completion period | `PeriodSpec.validate_period` | 7/7 | 6/6 | Naive start / naive end / start > end |
| BR-ENC-05 persistence | `EncounterViewSet.perform_update` | 4/4 | – | – |
| BR-ENC-06 restart | `EncounterViewSet.restart` | 12/12 | 6/6 | 3-condition table, A/B/C pairs |

BR-ENC-02 and BR-ENC-04 have **no server-side code**. BR-ENC-02 is enforced only in the browser (defect DEF-03); BR-ENC-04 is a frontend routing decision. They're covered by:
- `testing/frontend/test_encounter_frontend_rules.ts`: the BR-ENC-04 truth table
- the Playwright use-case flows `E2E-ENC-001/003/007`

## 2. Whole-file coverage of the in-scope modules

| File | Coverage |
|---|---:|
| `care/emr/resources/encounter/spec.py` | **100%** |
| `care/emr/resources/encounter/constants.py` | **100%** |
| `care/emr/api/viewsets/encounter.py` | 68% |
| `care/emr/resources/base.py` (shared) | 83% |
| `care/security/authorization/encounter.py` | 59% |
| **Total** | **78%** |

## 3. Justification of uncovered code (none of it is business-rule logic for the two workflows)

| File | Lines | What it is | Why not covered |
|---|---|---|---|
| viewset | 62–66 | `LiveFilter` `live=true/false` branches | Their behaviour is inverted (**DEF-19**). A test would have to assert the defect; documented as 13 surviving mutants |
| viewset | 207–209 | Releasing the create lock when identifier evaluation raises | Exception-only path; the recovery test injects the failure at lock *acquire* instead (`REC-ENC-001`) |
| viewset | 305–316, 327–343, 350–366 | `organizations`, `organizations_add`, `organizations_remove` actions | Department management of an existing encounter; not a step of Create or Complete |
| viewset | 375–416 | `set_facility_identifier` action | Facility identifier management; outside both workflows |
| viewset | 423–457 | Other custom actions after `set_facility_identifier` | Outside both workflows |
| authorization | 42–58, 65, 73–81, 101–104, 136+ | `can_view_encounter_clinical_data`, `can_view_as_pharmacist`, `can_submit_encounter_questionnaire_obj`, `can_update_encounter_clinical_data`, service-request / medication / diagnostic-report helpers | Permission helpers for other EMR features (questionnaires, pharmacy, lab). The encounter create/read/update/list checks *are* covered (API-ENC-027–038, SEC-AC-01–10) |
| base | 35–37, 48, 62–63, … | Generic `EMRResource` helpers | Shared framework code used by every CARE resource; outside scope |
