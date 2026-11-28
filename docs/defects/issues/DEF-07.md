**Defect ID:** DEF-07
**Severity:** Minor  |  **Priority:** P4  |  **Status:** Open
**Category:** accessibility
**Triage decision:** Report upstream

### Steps to reproduce
1. Open an encounter's updates screen.
2. Run axe-core.

### Expected
Accessible name starts with the visible label (WCAG 2.5.3).

### Actual
e.g. visible 'Symptoms', name 'Add Symptom' (8 controls).

### Evidence
testing/accessibility/after/axe-complete.md; care_fe/src/pages/Encounters/tabs/overview/quick-actions.tsx:142-143

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
