# Creates the defect GitHub Issues. Requires the GitHub CLI and `gh auth login`.
# Run from the repository root:  powershell -File docs/defects/create-issues.ps1
$ErrorActionPreference = "Stop"
$repo = "NovweraAmjad/CARE-Encounter-Management-SQE"
gh label create "category:accessibility" --repo $repo --force | Out-Null
gh label create "category:business-rule" --repo $repo --force | Out-Null
gh label create "category:documentation" --repo $repo --force | Out-Null
gh label create "category:functional" --repo $repo --force | Out-Null
gh label create "category:reliability" --repo $repo --force | Out-Null
gh label create "category:security" --repo $repo --force | Out-Null
gh label create "category:test-infrastructure" --repo $repo --force | Out-Null
gh label create "category:usability" --repo $repo --force | Out-Null
gh label create "category:validation" --repo $repo --force | Out-Null
gh label create "defect" --repo $repo --force | Out-Null
gh label create "priority:P1" --repo $repo --force | Out-Null
gh label create "priority:P2" --repo $repo --force | Out-Null
gh label create "priority:P3" --repo $repo --force | Out-Null
gh label create "priority:P4" --repo $repo --force | Out-Null
gh label create "severity:Major" --repo $repo --force | Out-Null
gh label create "severity:Minor" --repo $repo --force | Out-Null
gh label create "status:Fixed" --repo $repo --force | Out-Null
gh label create "status:Open" --repo $repo --force | Out-Null
gh label create "status:Won't fix" --repo $repo --force | Out-Null
gh issue create --repo $repo --title "[DEF-01] POST /api/v1/encounter/ returns HTTP 500 for external_identifier longer than 100 characters" --body-file "docs/defects/issues/DEF-01.md" --label "severity:Major" --label "priority:P2" --label "status:Open" --label "category:validation" --label "defect"
gh issue create --repo $repo --title "[DEF-02] PUT /api/v1/encounter/{id}/ returns HTTP 500 when hospitalization is null" --body-file "docs/defects/issues/DEF-02.md" --label "severity:Major" --label "priority:P2" --label "status:Open" --label "category:validation" --label "defect"
gh issue create --repo $repo --title "[DEF-03] Backend accepts a non-planned encounter with a future start date (BR-ENC-02 only enforced in the browser)" --body-file "docs/defects/issues/DEF-03.md" --label "severity:Major" --label "priority:P1" --label "status:Open" --label "category:business-rule" --label "defect"
gh issue create --repo $repo --title "[DEF-04] Create Encounter: time input has no accessible name and the BR-ENC-02 error is not linked to the field" --body-file "docs/defects/issues/DEF-04.md" --label "severity:Major" --label "priority:P2" --label "status:Fixed" --label "category:accessibility" --label "defect"
# DEF-04 is Fixed: after creating it, close it with: gh issue close <number> --repo $repo --reason completed
gh issue create --repo $repo --title "[DEF-05] Date-picker calendar icon is an unnamed role=img" --body-file "docs/defects/issues/DEF-05.md" --label "severity:Minor" --label "priority:P4" --label "status:Open" --label "category:accessibility" --label "defect"
gh issue create --repo $repo --title "[DEF-06] Encounter screen has an empty span[role=button] sheet trigger with no accessible name" --body-file "docs/defects/issues/DEF-06.md" --label "severity:Major" --label "priority:P3" --label "status:Open" --label "category:accessibility" --label "defect"
gh issue create --repo $repo --title "[DEF-07] Quick-action accessible names do not contain their visible text" --body-file "docs/defects/issues/DEF-07.md" --label "severity:Minor" --label "priority:P4" --label "status:Open" --label "category:accessibility" --label "defect"
gh issue create --repo $repo --title "[DEF-08] Encounter status dot uses aria-label on a plain div" --body-file "docs/defects/issues/DEF-08.md" --label "severity:Minor" --label "priority:P4" --label "status:Open" --label "category:accessibility" --label "defect"
gh issue create --repo $repo --title "[DEF-09] Tab moves focus outside the Create Encounter dialog after Submit" --body-file "docs/defects/issues/DEF-09.md" --label "severity:Minor" --label "priority:P3" --label "status:Open" --label "category:accessibility" --label "defect"
gh issue create --repo $repo --title "[DEF-10] Missing encounter type shows only 'Required'" --body-file "docs/defects/issues/DEF-10.md" --label "severity:Minor" --label "priority:P4" --label "status:Open" --label "category:usability" --label "defect"
gh issue create --repo $repo --title "[DEF-11] Hidden sr-only duplicate 'Mark as Completed' button" --body-file "docs/defects/issues/DEF-11.md" --label "severity:Minor" --label "priority:P4" --label "status:Open" --label "category:accessibility" --label "defect"
gh issue create --repo $repo --title "[DEF-12] Encounter screen requests /account/default_account/ and gets 400 on every load" --body-file "docs/defects/issues/DEF-12.md" --label "severity:Minor" --label "priority:P3" --label "status:Open" --label "category:functional" --label "defect"
gh issue create --repo $repo --title "[DEF-13] JWTs stored in localStorage and production CSP is report-only" --body-file "docs/defects/issues/DEF-13.md" --label "severity:Major" --label "priority:P2" --label "status:Open" --label "category:security" --label "defect"
gh issue create --repo $repo --title "[DEF-14] Backend dependencies with published advisories (Django 6.0, DRF 3.16.1, PyJWT 2.12.0, authlib, Pillow, urllib3, cryptography)" --body-file "docs/defects/issues/DEF-14.md" --label "severity:Major" --label "priority:P1" --label "status:Open" --label "category:security" --label "defect"
gh issue create --repo $repo --title "[DEF-15] Local settings allow any CORS origin and any host" --body-file "docs/defects/issues/DEF-15.md" --label "severity:Minor" --label "priority:P4" --label "status:Won't fix" --label "category:security" --label "defect"
# DEF-15 is Won't fix: after creating it, close it with: gh issue close <number> --repo $repo --reason "not planned"
gh issue create --repo $repo --title "[DEF-16] Mutation campaign never produced a mutmut score (local and CI)" --body-file "docs/defects/issues/DEF-16.md" --label "severity:Major" --label "priority:P1" --label "status:Fixed" --label "category:test-infrastructure" --label "defect"
# DEF-16 is Fixed: after creating it, close it with: gh issue close <number> --repo $repo --reason completed
gh issue create --repo $repo --title "[DEF-17] Complete-encounter E2E test clicked a hidden shortcut button through JavaScript" --body-file "docs/defects/issues/DEF-17.md" --label "severity:Minor" --label "priority:P2" --label "status:Fixed" --label "category:test-infrastructure" --label "defect"
# DEF-17 is Fixed: after creating it, close it with: gh issue close <number> --repo $repo --reason completed
gh issue create --repo $repo --title "[DEF-18] testing/README.md backend test command used the wrong PYTHONPATH" --body-file "docs/defects/issues/DEF-18.md" --label "severity:Minor" --label "priority:P3" --label "status:Fixed" --label "category:documentation" --label "defect"
# DEF-18 is Fixed: after creating it, close it with: gh issue close <number> --repo $repo --reason completed
gh issue create --repo $repo --title "[DEF-19] Encounter list filter live=true returns only completed/cancelled encounters (the 'Live' view shows ended encounters)" --body-file "docs/defects/issues/DEF-19.md" --label "severity:Major" --label "priority:P2" --label "status:Open" --label "category:functional" --label "defect"
gh issue create --repo $repo --title "[DEF-20] Unhandled (floating) promises from queryClient.invalidateQueries in the create and complete flows" --body-file "docs/defects/issues/DEF-20.md" --label "severity:Major" --label "priority:P2" --label "status:Fixed" --label "category:reliability" --label "defect"
# DEF-20 is Fixed: after creating it, close it with: gh issue close <number> --repo $repo --reason completed
