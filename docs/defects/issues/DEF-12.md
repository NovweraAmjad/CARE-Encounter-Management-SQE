**Defect ID:** DEF-12
**Severity:** Minor  |  **Priority:** P3  |  **Status:** Open
**Category:** functional
**Triage decision:** Report upstream

### Steps to reproduce
1. Open an encounter's updates screen.
2. Watch the network log.

### Expected
No failing request when no billing account is configured.

### Actual
GET .../account/default_account/ -> 400 (Lighthouse errors-in-console).

### Evidence
testing/accessibility/after/lighthouse-complete-navigation.json

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
