# Server-Side Business Rule Audit

| Rule | Source function / condition | Test IDs | Statement coverage | Branch coverage | MCC / MC/DC |
|---|---|---|---|---|---|
| BR-ENC-01 | `EncounterViewSet.validate_data`: create/update, active count, patient exists, facility exists | `UNIT-ENC-001`, `UNIT-ENC-002`, `UNIT-ENC-003`, `UNIT-ENC-004`, `UNIT-ENC-006`, `API-ENC-001`, `API-ENC-002` | 100% (8/8) | 100% (8/8) | MCC rows cover count/patient/facility/create-update; MC/DC pairs mapped in `mcc-mcdc.md` |
| BR-ENC-03 | `EncounterCreateSpec.perform_extra_deserialization`; `EncounterUpdateSpec.perform_extra_deserialization`; status-history decision | `UNIT-ENC-009`, `UNIT-ENC-010`, `UNIT-ENC-011`, `UNIT-ENC-012`, `UNIT-ENC-013`, `UNIT-ENC-014`, `API-ENC-003`, `API-ENC-004` | Create 100% (7/7); Update 100% (5/5) | Create 100% (4/4); Update 100% (4/4) | Create simple/appointment branches and update old-status-equals/differs; invalid enum Pydantic test |
| BR-ENC-05 | `PeriodSpec.validate_period`; `EncounterViewSet.perform_update` period deserialization/persistence | `UNIT-ENC-015`-`UNIT-ENC-019`, `API-ENC-008`, `API-ENC-009` | PeriodSpec 100% (7/7); perform_update 100% (4/4) | PeriodSpec 100% (6/6); perform_update 0 branches | MCC rows cover naive start, naive end and start> end; missing/existing end persistence |
| BR-ENC-06 | `EncounterViewSet.restart`: authorization, completed status, elapsed time | `API-ENC-005`, `API-ENC-010`, `API-ENC-011`, `API-ENC-012` | 100% (12/12) | 100% (6/6) | Complete three-condition restart table and executable A/B/C pairs |

## Remaining Uncovered Code

The three scoped modules still contain unrelated uncovered methods. Examples include
encounter filter helpers, organization management, identifier management, care-team
management and unrelated query branches.

These are outside BR-ENC-01, BR-ENC-03, BR-ENC-05 and BR-ENC-06 and do not invalidate
100% coverage of the selected business-rule functions.
