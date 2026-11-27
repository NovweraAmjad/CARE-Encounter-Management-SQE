# MCC and MC/DC Evidence - CARE Encounter Management

## Scope

The critical server-side business-rule logic is implemented in:

- `care/care/emr/api/viewsets/encounter.py`
  - `EncounterViewSet.validate_data` for BR-ENC-01
  - `EncounterViewSet.restart` for BR-ENC-06
- `care/care/emr/resources/encounter/spec.py`
  - `EncounterCreateSpec.perform_extra_deserialization`
  - `EncounterUpdateSpec.perform_extra_deserialization`
- `care/care/emr/resources/base.py`
  - `PeriodSpec.validate_period` for BR-ENC-05

Coverage.py proves statement and branch coverage. MCC and MC/DC below are
condition-pair analyses with executable test IDs; coverage percentages alone do
not prove these criteria.

## BR-ENC-01 - Multiple condition coverage

Source decisions in `EncounterViewSet.validate_data`:

- A: `model_obj is None` for create-versus-update.
- B: active encounter count is at least the configured maximum.
- C: patient exists.
- D: facility exists.

For creation, the active-count, patient and facility decisions are sequential.
For update, A is false and B/C/D are not evaluated. The relevant MCC rows are:

| Row | A Create | B Count at limit | C Patient exists | D Facility exists | Expected outcome | Test ID |
|---|---|---|---|---|---|---|
| 1 | True | False | True | True | Creation allowed | `API-ENC-001`, `API-ENC-002` |
| 2 | True | False | False | True | Patient does not exist | `UNIT-ENC-002` |
| 3 | True | False | True | False | Facility does not exist | `UNIT-ENC-003` |
| 4 | True | True | True | True | Active-limit validation error | `UNIT-ENC-001`, `API-ENC-001` |
| 5 | True | True | False | True | Limit check rejects before patient check | `UNIT-ENC-001` |
| 6 | True | True | True | False | Limit check rejects before facility check | `UNIT-ENC-001` |
| 7 | True | False | False | False | Patient check rejects before facility check | `UNIT-ENC-002`, `UNIT-ENC-003` |
| 8 | False | Do not evaluate | Do not evaluate | Do not evaluate | Update skips create-only limit validation | `UNIT-ENC-006` |

Rows 5–7 are source-implementation combinations. Row 7 is not a separate persisted
database case because patient validation precedes facility validation.

MC/DC pairs for BR-ENC-01:

- **A create/update:** row 1 versus row 8. The result changes while the relevant
  row-specific value context is fixed for create-only validation.
- **B count limit:** row 1 versus row 4, with a valid patient/facility.
- **C patient exists:** row 1 versus row 2, with count below limit and facility
  valid.
- **D facility exists:** row 1 versus row 3, with count below limit and patient
  valid.

## BR-ENC-03 - Multiple condition coverage

The creation decision is `if not is_update`:

- True: initialize patient/facility/appointment and status history.
- False: do not initialize create-only fields.

Test IDs:

- `UNIT-ENC-009`: create deserialization initializes history.
- `UNIT-ENC-010`: appointment branch.
- `UNIT-ENC-011`: update call skips create-only initialization.
- `API-ENC-003`: changed status history persisted.
- `API-ENC-004`: unchanged status history not duplicated.

The update decision is `old_instance.status != self.status`:

| Row | Old status differs | Expected outcome | Test ID |
|---|---|---|---|
| 1 | True | Append exactly one history entry; preserve previous entries | `UNIT-ENC-012`, `API-ENC-003` |
| 2 | False | Preserve history without append | `UNIT-ENC-013`, `API-ENC-004` |

This is a simple decision, so MCC/MC/DC is satisfied by the two true/false pairs.
Invalid status values are covered by `UNIT-ENC-014` through Pydantic validation.

## BR-ENC-05 - Multiple condition coverage

`PeriodSpec.validate_period` has three relevant composite conditions:

- A: start exists and is naive.
- B: end exists and is naive.
- C: start and end exist and start is greater than end.

| Row | A Naive start | B Naive end | C Start > end | Expected outcome | Test ID |
|---|---|---|---|---|---|
| 1 | False | False | False | Period accepted | `UNIT-ENC-015`, `API-ENC-008` |
| 2 | True | False | False | Start naive rejected | `UNIT-ENC-016` |
| 3 | False | True | False | End naive rejected | `UNIT-ENC-017` |
| 4 | False | False | True | Start-after-end rejected | `UNIT-ENC-018`, `API-ENC-009` |
| 5 | True | True | False | Start-naive rejected before end-naive | `UNIT-ENC-016` |
| 6 | True | False | True | Start-naive rejected before ordering check | `UNIT-ENC-016` |
| 7 | False | True | True | End-naive rejected before ordering check | `UNIT-ENC-017` |
| 8 | True | True | True | Start-naive rejected first | `UNIT-ENC-016` |

The missing-end and existing-end cases are:

- Missing end: accepted and remains `None` (`UNIT-ENC-019`, `API-ENC-008`).
- Existing end: accepted and persists unchanged (`API-ENC-008`).
- Invalid start>end: 400 and persisted period unchanged (`API-ENC-009`).

MC/DC pairs:

- A: row 1 versus row 2 while B and C are false.
- B: row 1 versus row 3 while A and C are false.
- C: row 1 versus row 4 while A and B are false.

The application also preserves the existing period end and does not populate a missing
end in backend `EncounterUpdateSpec`. Missing end population belongs to the frontend
completion controller and is not implemented as a backend period-population rule.

## BR-ENC-06 - Multiple condition coverage

Three relevant restart conditions:

- A: user passes `can_restart_encounter_obj` authorization.
- B: encounter status is in `COMPLETED_CHOICES`.
- C: modified age is within `ENCOUNTER_RESTART_TIME_LIMIT_HOURS`.

| Row | A Authorized | B Completed | C Within limit | Expected outcome | Test ID |
|---|---|---|---|---|---|
| 1 | False | False | False | 403 authorization rejected | `API-ENC-012` |
| 2 | False | False | True | 403 authorization rejected | `API-ENC-012` |
| 3 | False | True | False | 403 authorization rejected | `API-ENC-012` |
| 4 | False | True | True | 403 authorization rejected | `API-ENC-012` |
| 5 | True | False | False | 400 status guard | `API-ENC-010` |
| 6 | True | False | True | 400 status guard | Not normally reached; infeasible through normal authorization |
| 7 | True | True | False | 400 expired window | `API-ENC-011` |
| 8 | True | True | True | 204 restart | `API-ENC-005` |

Rows 6 is infeasible through normal production authorization because
`can_restart_encounter_obj` rejects non-completed statuses before the view's status
guard. It is retained in the MCC table to show the authorization interaction and is
covered only in the isolated branch test `API-ENC-010` with C false, not row 6.

MC/DC pairs:

- **A authorization:** row 8 versus row 4, or row 7 versus row 3, while B and C stay
  fixed. Tests: successful completed restart and unauthorized completed restart.
- **B completed status:** row 7 versus row 5 while A is true and C is false.
  Tests: `API-ENC-011` and `API-ENC-010`, with elapsed time outside the limit.
- **C within limit:** row 8 versus row 7 while A and B are true.
  Tests: `API-ENC-005` and `API-ENC-011`.

The normal route rejected non-completed requests with 403 before the view status
guard. `API-ENC-010` patches only `AuthorizationController.call` to return true to
exercise the view guard in isolation; this patch does not change production logic.
