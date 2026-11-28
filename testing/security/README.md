# Section 4 – Defensive Security Assessment

Everything for Section 4 lives in this folder. The Section 3 tests in `testing/e2e/`
are not modified; ZAP re-runs them unchanged through a proxy.

The final report is [SECTION4-REPORT.md](SECTION4-REPORT.md).

## Folder layout

| Path | What it is |
|---|---|
| `specs/authorization.spec.ts` | 10 Playwright role checks (care-doctor vs care-volunteer, plus anonymous) |
| `specs/session-controls.spec.ts` | SC-01 cookies, token storage and headers after a real login; SC-02 logout token revocation |
| `playwright.security.config.ts` | Config for the two specs above |
| `playwright.zap.config.ts` | Runs `testing/e2e/specs/encounter-e2e.spec.ts` through the ZAP proxy |
| `zap/run-zap-passive.js` | Starts ZAP (daemon, passive only), runs the workflows, exports reports |
| `zap/analyze-zap.js` | Classifies alerts (genuine / dev artifact / false positive) and builds the header matrix |
| `zap/reports/` | ZAP HTML/JSON reports, grouped alerts, observed headers, `zap-analysis.md`, logs |
| `dependency-audit/` | pip-audit + npm audit raw output, `summarize-audit.js`, summary |
| `evidence/` | Authorization results (JSON + Markdown), screenshots, Playwright HTML report |

## Prerequisites

- CARE backend running on `http://127.0.0.1:9000` (Docker container `care-backend-1`)
  with the default fixtures loaded (`care-doctor`, `care-volunteer`, password from
  CARE's `load_fixtures` output — synthetic local accounts only).
- Frontend on `http://localhost:4000` (started automatically by Playwright if not running).
- Node 18+, Java 17+ (for ZAP), Python 3.10+ (for pip-audit).

## 1. Role-based authorization checks (Playwright)

```powershell
cd testing\security
npm install
npx playwright test --config=playwright.security.config.ts
```

Results: `evidence/authorization-results.md` / `.json`, `evidence/session-controls.json`,
screenshots in `evidence/screenshots/`, HTML report in `evidence/playwright-html/`.

## 2. OWASP ZAP passive scan

ZAP 2.17.0 was used. Any ZAP install works; set `ZAP_HOME` to the folder containing
`zap-<version>.jar`. (Here it was copied out of the already-pulled Docker image with
`docker create --name zap-extract ghcr.io/zaproxy/zaproxy:stable` +
`docker cp zap-extract:/zap <folder>` + `docker rm zap-extract`.)

```powershell
cd testing\security
$env:ZAP_HOME = "C:\path\to\zap"
node zap\run-zap-passive.js
```

The script never starts the spider or the active scanner. It only proxies the two
normal Section 3 workflows, waits for the passive queue to empty (5–10 minutes,
because the Vite dev server serves hundreds of un-bundled modules), then writes
`zap/reports/`. Then classify the alerts:

```powershell
node zap\analyze-zap.js
```

## 3. Dependency audit

```powershell
cd testing\security
# Backend: exact installed versions from the running container
docker exec care-backend-1 /.venv/bin/pip freeze --exclude-editable > dependency-audit\backend-installed-packages.txt

# pip-audit in an isolated venv (does not touch the project or the container)
python -m venv $env:TEMP\audit-venv
& $env:TEMP\audit-venv\Scripts\python -m pip install pip-audit
& $env:TEMP\audit-venv\Scripts\pip-audit -r dependency-audit\backend-installed-packages.txt --no-deps --disable-pip --vulnerability-service osv  -f json -o dependency-audit\backend-pip-audit-osv.json  --desc on
& $env:TEMP\audit-venv\Scripts\pip-audit -r dependency-audit\backend-installed-packages.txt --no-deps --disable-pip --vulnerability-service pypi -f json -o dependency-audit\backend-pip-audit-pypi.json --desc on

# Frontend and test tooling (reads package-lock.json only)
cd ..\..\care_fe;        npm audit --json > ..\testing\security\dependency-audit\npm-audit-care_fe.json
cd ..\testing\e2e;       npm audit --json > ..\security\dependency-audit\npm-audit-testing-e2e.json
cd ..\security;          npm audit --json > dependency-audit\npm-audit-testing-security.json

# Merge, de-duplicate aliases, add OSV severities
node dependency-audit\summarize-audit.js
```

(In Git Bash, prefix the `docker exec` line with `MSYS_NO_PATHCONV=1`.)

## Safety constraints followed

- Only synthetic fixture data and the local fixture accounts were used.
- No active scanning, fuzzing or brute forcing. Denied requests change nothing; the
  only allowed write is a no-op PUT that re-sends an encounter's current values.
- Token values are never written to evidence files (only key names and lengths).
