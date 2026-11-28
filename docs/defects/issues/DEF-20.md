**Defect ID:** DEF-20
**Severity:** Major  |  **Priority:** P2  |  **Status:** Fixed
**Category:** reliability
**Triage decision:** Fix now - mark fire-and-forget invalidations with void (testing/sonar/care_fe-floating-promises-fix.patch), delivered through a pull request

### Steps to reproduce
1. Run SonarQube (testing/sonar/sonar-gate.sh) on the scoped modules.

### Expected
Reliability rating A (no bugs).

### Actual
5 x typescript:S9383 (CreateEncounterForm.tsx:197; useEncounterProgressController.ts:34,41,44,45); Reliability rating C; quality gate FAILED.

### Evidence
testing/sonar/results/ (before fix); docs/reports/sonarqube-analysis.md; gate ERROR -> OK after the fix (testing/sonar/results-before-fix vs results-after-fix)

_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._
