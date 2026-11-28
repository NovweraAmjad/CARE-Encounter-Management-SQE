**Defect ID:** DEF-08
**Severity:** Minor  |  **Priority:** P4  |  **Status:** Open
**Category:** accessibility
**Triage decision:** Report upstream

### Steps to reproduce
1. Open Patient Home.
2. Run Lighthouse.

### Expected
Status available to assistive technology.

### Actual
aria-prohibited-attr on div[aria-label='Planned'] (EncounterCard.tsx:53-58).

### Evidence
testing/accessibility/after/lighthouse-create-navigation.json

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
