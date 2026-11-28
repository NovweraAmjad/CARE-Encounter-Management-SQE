# Section 3 – Usability and Accessibility Evidence

## What is here

| Path | Contents |
|---|---|
| [`issue-analysis.md`](./issue-analysis.md) | Every unique issue with its element, user impact, proposed fix and before/after status. Issues found by both tools are counted once. |
| [`comparison.md`](./comparison.md) / `comparison.json` | Before/after Lighthouse scores, axe counts and per-issue status |
| `before/` | Audit **before** the fix: Lighthouse JSON+HTML (`create-navigation`, `create-dialog-snapshot`, `complete-navigation`), axe JSON, summary and Markdown, screenshots, `audit-summary.json`, `error-association.json` |
| `after/` | The same set **after** the fix, plus `care_fe-create-encounter-fix.patch` |
| `initial-run-2026-11-27/` | The first audit run, kept for reference |
| `../e2e/reports/playwright-html/` | Playwright HTML report for the two workflow tests, with the keyboard focus-order and rejected-value screenshot attachments |

## Results at a glance

| Screen | Lighthouse A11y (before → after) | Best Practices | SEO | axe violations (before → after) |
|---|---|---:|---:|---|
| Create Encounter dialog (snapshot) | 94 → **99** | 100 | 100 | 2 → **1** |
| Patient Home (navigation) | 96 → 96 | 100 | 100 | (dialog scan above) |
| Complete Encounter (navigation; not changed) | 96 → 96 | 96 | 100 | 2 → 2 |

Unique issues: **6 before → 5 after**. The critical `label` issue was fixed, along with the unannounced business-rule error.

## Playwright workflow tests (`testing/e2e/specs/encounter-e2e.spec.ts`)

1. **Create a patient encounter with keyboard validation correction**
   - **Opens:** Patient Home, then the Create Encounter dialog.
   - **Keyboard order:** checks that Tab reaches Date → Time → Type of Encounter → Status → Priority → Departments → Submit, in that order. The focus log is attached to the report.
   - **Rejected value:** using only the keyboard, it enters a **future start date with status In Progress**. It checks that the BR-ENC-02 message "Future date is only allowed for planned encounters" appears under the Date and Time field, and that no request is sent.
   - **Correction:** it corrects the date to today with the keyboard and confirms the error disappears.
   - **Server rule:** a keyboard submit hits the server rule BR-ENC-01 ("maximum number of active encounters"). The test then clears the setup encounters and submits again with the keyboard.
   - **Success:** it checks for the "Encounter created successfully" confirmation, the redirect, and the stored `in_progress`/`amb` record.
2. **Complete an existing encounter**
   - **Opens** the encounter screen and uses the visible **Actions → Mark as Completed** button, then confirms in the dialog.
   - **Checks** the "Encounter Completed" confirmation, the "Status History: Completed" button, and the stored `completed` status.

## How to reproduce

Backend on `:9000` with fixtures loaded. Frontend:

```powershell
cd care_fe
$env:REACT_CARE_API_URL="http://127.0.0.1:9000"
npm run local -- --host 127.0.0.1 --port 4000
```

Second terminal:

```powershell
cd testing/e2e
npm test                                  # two workflow tests + HTML report
node accessibility-run.js before          # Lighthouse + axe -> ../accessibility/before
node verify-error-association.js before   # field name / error association
# apply the fix (../accessibility/after/care_fe-create-encounter-fix.patch) in care_fe
node accessibility-run.js after
node verify-error-association.js after
node accessibility-compare.js             # -> ../accessibility/comparison.md
```

Only the synthetic fixture account `care-doctor` and Faker-generated patients are used.
