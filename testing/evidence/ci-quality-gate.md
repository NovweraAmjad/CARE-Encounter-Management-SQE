# CI Quality Gate

## Status

No GitHub Actions pipeline run or real pull-request outcome is claimed. The
workflow is implemented for future pull-request execution.

## Threshold rationale

- Coverage: 100% statement and branch coverage for selected business-rule
  functions, measured by `testing/mutation/coverage_quality_gate.py`.
- Mutation: initial enforced threshold 80%, using
  `killed / (killed + survived) * 100`. Timeouts and equivalents are reported
  separately.
- Sonar: Sonar's configured quality gate must pass.

## Pull-request jobs

The workflow runs:

1. Python unit, integration and generator tests.
2. Coverage measurement and selected-function coverage gate.
3. Mutation campaign and mutation score gate.
4. Frontend and Playwright Chromium tests where services are available.
5. SonarQube scan and quality gate.

## Required secrets

- `SONAR_HOST_URL`
- `SONAR_TOKEN`

Both secrets are referenced only through GitHub Secrets and are not printed.

## Evidence pending real GitHub execution

- A pull request that fails a real quality gate.
- The same pull request fixed and passing.
- A separate pull request blocked until required checks pass.
- Workflow URL, commit SHA and timestamp.
