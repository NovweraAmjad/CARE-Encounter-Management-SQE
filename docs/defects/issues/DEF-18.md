**Defect ID:** DEF-18
**Severity:** Minor  |  **Priority:** P3  |  **Status:** Fixed
**Category:** documentation
**Triage decision:** Fix now

### Steps to reproduce
1. Run the README command.

### Expected
Tests run.

### Actual
ModuleNotFoundError: No module named 'care_testing'.

### Evidence
Reproduced 28 Nov 2026; README now uses PYTHONPATH=/tmp:/app (as CI)

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
