**Defect ID:** DEF-03
**Severity:** Major  |  **Priority:** P1  |  **Status:** Open
**Category:** business-rule
**Triage decision:** Report upstream - add the BR-ENC-02 check to server-side create validation

### Steps to reproduce
1. Log in as care-doctor.
2. POST /api/v1/encounter/ with status 'in_progress' and period.start = tomorrow.

### Expected
HTTP 400 'Future date is only allowed for planned encounters' (the UI blocks this input).

### Actual
HTTP 200; the encounter is stored as in_progress with a future start.

### Evidence
Live API check 28 Nov 2026 (record cancelled afterwards); UI rejection in testing/e2e/specs/encounter-e2e.spec.ts; RCA-1

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
