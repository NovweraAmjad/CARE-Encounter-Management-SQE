**Defect ID:** DEF-16
**Severity:** Major  |  **Priority:** P1  |  **Status:** Fixed
**Category:** test-infrastructure
**Triage decision:** Fix now

### Steps to reproduce
1. Run testing/mutation/campaign.py.

### Expected
Mutation score.

### Actual
'failed to collect stats. runner returned 1' - score null.

### Evidence
RCA-3; testing/mutation/results/

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
