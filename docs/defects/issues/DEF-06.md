**Defect ID:** DEF-06
**Severity:** Major  |  **Priority:** P3  |  **Status:** Open
**Category:** accessibility
**Triage decision:** Report upstream

### Steps to reproduce
1. Open an encounter's updates screen.
2. Run axe-core or Lighthouse.

### Expected
Every focusable control has a name.

### Actual
aria-command-name on span[data-slot=sheet-trigger] (axe serious + Lighthouse).

### Evidence
testing/accessibility/after/axe-complete.md

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
