**Defect ID:** DEF-09
**Severity:** Minor  |  **Priority:** P3  |  **Status:** Open
**Category:** accessibility
**Triage decision:** Report upstream

### Steps to reproduce
1. Open Create Encounter.
2. Press Tab repeatedly.

### Expected
Focus stays inside the modal.

### Actual
After Submit, focus moves to a span outside the dialog, then returns to Close.

### Evidence
Playwright report attachment keyboard-focus-order.json

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
