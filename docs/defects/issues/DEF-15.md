**Defect ID:** DEF-15
**Severity:** Minor  |  **Priority:** P4  |  **Status:** Won't fix
**Category:** security
**Triage decision:** Won't fix - local development settings only

### Steps to reproduce
1. Observe the API response headers.

### Expected
Allow-list.

### Actual
Access-Control-Allow-Origin: *.

### Evidence
ZAP 10098; care/config/settings/local.py:12

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
