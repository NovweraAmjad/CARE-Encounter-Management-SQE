**Defect ID:** DEF-19
**Severity:** Major  |  **Priority:** P2  |  **Status:** Open
**Category:** functional
**Triage decision:** Report upstream - invert LiveFilter (live=true -> exclude COMPLETED_CHOICES); upstream test test_filters_by_live_as_true currently asserts the inverted behaviour

### Steps to reproduce
1. Log in as care-doctor.
2. GET /api/v1/encounter/?facility={id}&live=true and &live=false.

### Expected
live=true lists open (in-progress/planned/on-hold) encounters, as the frontend EncounterList sends live=true for its "live" status (EncounterList.tsx:129-130).

### Actual
live=true -> 200 completed/cancelled only; live=false -> open only (LiveFilter in emr/api/viewsets/encounter.py:57-66).

### Evidence
Live API check 28 Nov 2026; 13 LiveFilter mutants survive because killing them would require asserting the defective behaviour (testing/evidence/mutation-analysis.md)

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
