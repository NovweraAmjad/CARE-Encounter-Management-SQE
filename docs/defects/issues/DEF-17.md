**Defect ID:** DEF-17
**Severity:** Minor  |  **Priority:** P2  |  **Status:** Fixed
**Category:** test-infrastructure
**Triage decision:** Fix now

### Steps to reproduce
1. Read testing/e2e/specs/encounter-e2e.spec.ts (before).

### Expected
Test uses the user-visible control.

### Actual
element.click() on a 2x2px sr-only button.

### Evidence
Current spec uses the Actions-panel button

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
