**Defect ID:** DEF-01
**Severity:** Major  |  **Priority:** P2  |  **Status:** Open
**Category:** validation
**Triage decision:** Report upstream - add max_length=100 to EncounterCreateSpec/UpdateSpec.external_identifier

### Steps to reproduce
1. Log in as care-doctor (synthetic fixture account).
2. POST /api/v1/encounter/ with a valid payload and external_identifier = 'X' * 101.

### Expected
HTTP 400 with a validation message (the database column is varchar(100)).

### Actual
HTTP 500, django.db.utils.DataError: value too long for type character varying(100). A 100-character value returns 200.

### Evidence
API-ENC-014; live re-run 28 Nov 2026; testing/evidence/endpoint-weaknesses.md (EW-01); RCA-2 in docs/defects/rca.md

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
