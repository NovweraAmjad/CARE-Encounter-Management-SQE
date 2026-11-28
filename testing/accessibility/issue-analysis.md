# Section 3 – Usability and Accessibility Issue Analysis

**Scope:** the key screen of each encounter workflow, audited while logged in as the synthetic `care-doctor` fixture account.

| Workflow | Key screen | Lighthouse run(s) | axe-core run |
|---|---|---|---|
| W1 Create Encounter | Patient Home with the **Create Encounter dialog open** | navigation of Patient Home, plus a **snapshot of the open dialog** (a reload would close it) | full page, dialog open |
| W2 Complete Encounter | Encounter `…/encounter/{id}/updates`, with the Actions panel open | navigation | full page |

**Tools:** Lighthouse 13.6.0 (accessibility, best-practices, seo); axe-core 4.14.1 (via `@axe-core/playwright` 4.14.1); Playwright 1.65.1.

**Evidence:**
- `before/` and `after/` hold the raw JSON and HTML reports, axe Markdown, screenshots and `audit-summary.json`.
- `comparison.md` compares the two runs.
- `initial-run-2026-11-27/` is the first audit, kept for reference. Its Lighthouse "create" run reloaded the page, so it never saw the dialog. It was replaced by the snapshot-mode run above.

**Counting rule:** Lighthouse accessibility audits are axe-core rules, so an issue is identified by its screen and rule id. An issue reported by both tools is counted **once**.

---

## 1. Tool-detected issues (deduplicated)

| # | Screen | Rule | Detected by | Element | User impact | Proposed fix | After fix |
|---|---|---|---|---|---|---|---|
| A1 | Create | `label` (axe: **critical**) | axe-core + Lighthouse snapshot | `input[type="time"]` in the **Date and Time** field of the Create Encounter dialog (`care_fe/src/components/Encounter/CreateEncounterForm.tsx` ~l.294). The `FormLabel` points to an id that no element has. | Screen-reader users hear only "time, edit" with no purpose. Voice-control users can't say "click Date and Time". A business-rule error on this field isn't announced either (see U1). | Wrap the input in `<FormControl>` so it gets the label's id, `aria-invalid` and `aria-describedby`. | **Fixed** |
| A2 | Create | `svg-img-alt` (serious) | axe-core + Lighthouse snapshot | `svg.care-l-calender[role="img"]` inside the date-picker button (`care_fe/src/components/ui/date-picker.tsx:48`; `CareIcon` always sets `role="img"`) | Screen readers announce an unnamed "image" before the date, adding noise to every date field. | The icon is decorative because the button already shows the date. Add `aria-hidden="true"`, either with an `aria-hidden` prop on `CareIcon` or a hidden wrapper in `DatePicker`. | Remaining (see note 1) |
| A3 | Create (Patient Home) | `aria-prohibited-attr` | Lighthouse | `div[aria-label="Planned"]`: the status dot in the encounter timeline (`care_fe/src/components/Facility/EncounterCard.tsx:53-58`) | `aria-label` isn't allowed on a plain `div`, so screen readers drop it. The encounter status is shown only by colour and icon. | Add `role="img"` with the `aria-label`, or add visually hidden status text. | Remaining |
| A4 | Complete | `aria-command-name` (serious) | axe-core + Lighthouse | Empty `span[role="button"][data-slot="sheet-trigger"][aria-haspopup="dialog"]` at `main#pages > div.flex > div.contents > span` (Base UI sheet trigger with no content) | Keyboard users land on an invisible, unnamed stop. Screen readers announce just "button" with no purpose. | Give the trigger an accessible name, or don't render a trigger when the sheet is opened by code. | Remaining |
| A5 | Complete | `label-content-name-mismatch` (serious; Lighthouse weight 0) | axe-core + Lighthouse | 8 quick actions, e.g. `a[aria-label="Add Symptom"]` showing **"Symptoms"** (`care_fe/src/pages/Encounters/tabs/overview/quick-actions.tsx:142-143`). The others are Add Allergy, Add Diagnosis, Add Medication, Add Procedure, Service Request, and the "Forms" and "New Referral" buttons. | Voice-control users who say the visible word ("click Symptoms") don't match the name "Add Symptom". Screen-reader and sighted users perceive different labels. | Make the accessible name start with the visible text (e.g. "Symptoms – add"), or remove the `aria-label` and add visually hidden text. | Remaining |
| A6 | Complete | `errors-in-console` (Best Practices) | Lighthouse | Network request `GET /api/v1/facility/{id}/account/default_account/` → **400 Bad Request** on page load | The screen queries a billing account that doesn't exist for this encounter, so billing information is missing. Errors are logged on every load. | Treat "no default account" as an empty state (don't request it when billing isn't set up), or have the API return 404/empty instead of 400. | Remaining |

**Unique tool issues:** 6 before, **5 after**.

`valid-source-maps` (weight 0) was excluded as a development-server artifact: the Vite dev server's source maps can't be validated, and production builds behave differently. SEO scored 100 on every screen.

> **Note 1:** `care_fe/AGENTS.md` says the shared primitives in `src/components/ui/` must not be modified directly. A2 was therefore left unfixed, and the fix above is the proposed change.

> **Initial run (27 Nov):** Patient Home also logged a 403 on `GET /api/v1/encounter/?patient=…`. That request didn't fail in the later runs, so it isn't counted. Its JSON is in `initial-run-2026-11-27/lighthouse-create.json`.

## 2. Usability issues found by the Playwright tests

These come from the automated browser tests (`testing/e2e/specs/encounter-e2e.spec.ts`), not from the scanners.

| # | Screen | Element | Observation (evidence) | User impact | Proposed fix | After fix |
|---|---|---|---|---|---|---|
| U1 | Create | Date and Time field | The BR-ENC-02 message "Future date is only allowed for planned encounters" appears visually under the field. Before the fix, no control had `aria-invalid`, and the message wasn't linked to the field (`before/error-association.json`). | Screen-reader users aren't told which field is wrong, or why, when they return to it. | Same `<FormControl>` change as A1 | **Fixed**: `aria-invalid="true"` and `aria-describedby` → message (`after/error-association.json`) |
| U2 | Create | Create Encounter dialog (sheet) | The keyboard focus log shows that after **Submit**, Tab moves focus to a `span` **outside the dialog** before returning to "Close" (Playwright report attachment `keyboard-focus-order.json`). | Keyboard and screen-reader users briefly leave the modal, so its content is in an unclear state. | Keep the focus trap inside the sheet, so focus guards return focus to the first control. | Remaining |
| U3 | Create | Type of Encounter | Submitting without a type shows only **"Required"**. | The message names no field and gives no action. | Use a specific message, e.g. "Select the type of encounter". | Remaining |
| U4 | Complete | "Mark as Completed" | Besides the visible button in the Actions panel, the page has an `sr-only`, `tabIndex=-1` copy used as a keyboard-shortcut target (`care_fe/src/pages/Encounters/EncounterShow.tsx:262-268`). The previous test clicked that hidden copy through JavaScript. | Screen-reader users find two "Mark as Completed" buttons, and one of them can't be reached with Tab. | Trigger the shortcut from the shortcut handler without a DOM button, or mark the copy `aria-hidden`. | Remaining (the test now uses the visible button) |

## 3. Before/after summary (fixed screen: Create Encounter)

| Measure | Before | After |
|---|---:|---:|
| axe-core violations (rules) on the Create dialog | 2 (`label`, `svg-img-alt`) | **1** (`svg-img-alt`) |
| Lighthouse Accessibility, dialog snapshot | 94 | **99** |
| Lighthouse Accessibility, Patient Home navigation | 96 | 96 (A3 is on Patient Home, not the dialog) |
| Time input accessible name | none | "Date and Time" |
| Business-rule error linked to the field | no | yes |

The full table is in `comparison.md`. The fix is in `after/care_fe-create-encounter-fix.patch`, a one-component change with no behaviour change: both E2E tests pass before and after.
