**Defect ID:** DEF-05
**Severity:** Minor  |  **Priority:** P4  |  **Status:** Open
**Category:** accessibility
**Triage decision:** Defer - in shared src/components/ui primitive

### Steps to reproduce
1. Open the Create Encounter dialog.
2. Run axe-core.

### Expected
Decorative icon hidden from assistive technology.

### Actual
axe svg-img-alt (serious) on svg.care-l-calender.

### Evidence
testing/accessibility/after/axe-create.md

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
