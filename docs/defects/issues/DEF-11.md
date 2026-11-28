**Defect ID:** DEF-11
**Severity:** Minor  |  **Priority:** P4  |  **Status:** Open
**Category:** accessibility
**Triage decision:** Report upstream

### Steps to reproduce
1. Open an encounter screen with a screen reader.

### Expected
One 'Mark as Completed' control.

### Actual
An extra sr-only, tabIndex -1 button (EncounterShow.tsx:262-268).

### Evidence
Playwright locator count = 2

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
