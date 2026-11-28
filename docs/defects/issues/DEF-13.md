**Defect ID:** DEF-13
**Severity:** Major  |  **Priority:** P2  |  **Status:** Open
**Category:** security
**Triage decision:** Report upstream

### Steps to reproduce
1. Log in.
2. Inspect localStorage and the nginx config.

### Expected
Tokens not readable by page script; enforced CSP.

### Actual
care_access_token and care_refresh_token in localStorage; Content-Security-Policy-Report-Only.

### Evidence
testing/security/evidence/session-controls.json; care_fe/nginx/nginx.conf:14

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
