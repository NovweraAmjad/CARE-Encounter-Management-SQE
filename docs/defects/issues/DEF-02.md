**Defect ID:** DEF-02
**Severity:** Major  |  **Priority:** P2  |  **Status:** Open
**Category:** validation
**Triage decision:** Report upstream - reject null or coerce it to {} in the spec

### Steps to reproduce
1. Log in as care-doctor.
2. PUT /api/v1/encounter/{id}/ for an open encounter with hospitalization: null.

### Expected
HTTP 400, or null treated as an empty object.

### Actual
HTTP 500 IntegrityError (NOT NULL on emr_encounter.hospitalization). Record unchanged.

### Evidence
API-ENC-024; live re-run 28 Nov 2026; EW-02; RCA-2

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
