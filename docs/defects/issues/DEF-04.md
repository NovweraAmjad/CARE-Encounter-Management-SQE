**Defect ID:** DEF-04
**Severity:** Major  |  **Priority:** P2  |  **Status:** Fixed
**Category:** accessibility
**Triage decision:** Fix now - FormControl wrapper (one component)

### Steps to reproduce
1. Open Patient Home > Create Encounter.
2. Run axe-core, or inspect the time input with a screen reader.

### Expected
Input named 'Date and Time'; aria-invalid and aria-describedby set when the rule rejects the value.

### Actual
Before fix: no name (axe 'label', critical); no aria-invalid/describedby.

### Evidence
testing/accessibility/{before,after}/; testing/accessibility/after/care_fe-create-encounter-fix.patch

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
