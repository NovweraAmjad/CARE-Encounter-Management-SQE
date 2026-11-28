**Defect ID:** DEF-10
**Severity:** Minor  |  **Priority:** P4  |  **Status:** Open
**Category:** usability
**Triage decision:** Report upstream

### Steps to reproduce
1. Open Create Encounter.
2. Submit without choosing a type.

### Expected
A message that names the field and the action.

### Actual
'Required'.

### Evidence
testing/e2e/specs/use-cases.spec.ts UC1-EXC-1

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
