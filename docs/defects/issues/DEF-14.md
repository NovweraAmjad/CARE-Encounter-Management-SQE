**Defect ID:** DEF-14
**Severity:** Major  |  **Priority:** P1  |  **Status:** Open
**Category:** security
**Triage decision:** Report upstream - upgrade after team approval

### Steps to reproduce
1. pip-audit on the installed backend packages.

### Expected
No known advisories.

### Actual
119 unique advisories in 8 packages (7 Critical, 54 High).

### Evidence
testing/security/dependency-audit/dependency-audit-summary.md

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
