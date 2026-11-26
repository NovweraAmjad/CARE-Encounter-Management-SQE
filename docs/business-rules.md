## Business Rules - Encounter Management

### BR-ENC-01 - Active encounter limit

- **Rule statement:** A patient may not have more than the configured number of active encounters in a facility. The default value is `5`. An encounter is active when its status is not in `COMPLETED_CHOICES`: `completed`, `cancelled`, `entered_in_error` or `discontinued`.
- **Relevant workflow:** Create Patient Encounter.
- **Actual source:** `care/config/settings/config.py` - `MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY`, default `5`; `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.validate_data`; `care/care/emr/resources/encounter/constants.py` - `COMPLETED_CHOICES`.
- **How to test:** Create 4, 5 and 6 active encounters for the same patient in the same facility. The 5th and earlier creation behavior should be accepted if the count before creation is below 5, and the request that raises the count from 5 to 6 must receive a validation error. Repeat with completed, cancelled, entered-in-error or discontinued encounters and confirm they are excluded from the active count. Also test the same patient in a different facility.
- **Existing coverage:** `care/care/emr/tests/test_encounter_api.py` - `EncounterAPITests.test_validate_data_max_encounters`.

### BR-ENC-02 - Frontend future-start decision

- **Rule statement:** For a newly created encounter, a future `start_date` is valid only when `status` is `planned`. This rule requires both conditions: the status must be one of `planned`, `in_progress` or `on_hold`, and a non-planned status must not have a future start date.
- **Relevant workflow:** Create Patient Encounter.
- **Actual source:** `care_fe/src/components/Encounter/CreateEncounterForm.tsx` - `encounterFormSchema` refinement.
- **How to test:** Use equivalence and boundary values for status and start time: planned + future date, planned + current date, in-progress + current date, in-progress + future date, on-hold + future date, and an invalid status. Verify that only the future-date combinations rejected by the frontend are blocked and that submission does not call the create endpoint.
- **Note:** This is a frontend form rule. The inspected backend create spec does not show the same future-date validation; API tests should therefore verify which additional backend validation exists rather than assuming this frontend rule is enforced by the API.

### BR-ENC-03 - Encounter status-change and history rule

- **Rule statement:** An encounter status change is represented by `StatusChoices` and, in both creation and update specifications, the status history records the status and timestamp. On create, history starts with one entry for the initial status. On update, a new history entry is appended only when the old status differs from the submitted status.
- **Relevant workflow:** Create Patient Encounter and Complete Patient Encounter.
- **Actual source:** `care/care/emr/resources/encounter/constants.py` - `StatusChoices`, `COMPLETED_CHOICES`; `care/care/emr/resources/encounter/spec.py` - `EncounterCreateSpec.perform_extra_deserialization`, `EncounterUpdateSpec.perform_extra_deserialization`.
- **How to test:** Create each allowed initial status and confirm the first history entry. Update a status to a different allowed value and confirm the history length and timestamp change. Submit the same status again and confirm no duplicate history entry is appended. Test all enum values plus one invalid value.
- **Implementation boundary:** The source defines status values and restart restrictions, but no central backend state-transition matrix that rejects arbitrary transitions. Therefore, tests must distinguish “status enum is valid” from “a particular old-to-new transition is explicitly prohibited”.

### BR-ENC-04 - Inpatient discharge decision

- **Rule statement:** Completion is split into two actions when both Boolean conditions are true: the encounter class is `imp` and the encounter status is not `discharged`. In that case the frontend requires the discharge questionnaire; otherwise the frontend can submit the encounter update directly.
- **Relevant workflow:** Complete Patient Encounter.
- **Actual source:** `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` - `encounterRequiresDischarge`, `completeEncounter`, `completeEverything`.
- **How to test:** Exercise a truth table: inpatient/not discharged → questionnaire route; inpatient/discharged → direct completion; non-inpatient/not discharged → direct completion; non-inpatient/discharged → direct completion. Confirm that inpatient discharge navigation uses `toDischarge=true`.

### BR-ENC-05 - Completion period rule

- **Rule statement:** When completing an encounter from the frontend, the request preserves `period.start`, preserves `period.end` if it already exists, or sets `period.end` to the current browser ISO timestamp if no end exists.
- **Relevant workflow:** Complete Patient Encounter.
- **Actual source:** `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` - `addEncounterCloseRequestToBatch`.
- **How to test:** Use encounters with no end, an existing valid end and an existing future or invalid end according to available fixtures. Verify the outgoing PUT body: no end → current timestamp; existing end → unchanged end. Separately verify that the backend accepts the submitted status and period according to `EncounterUpdateSpec`.

### BR-ENC-06 - Restart eligibility rule

- **Rule statement:** An encounter may be restarted only when it is in a completed choice and its `modified_date` is within `ENCOUNTER_RESTART_TIME_LIMIT_HOURS`. A non-completed encounter, an expired encounter or an unauthorized user is rejected.
- **Relevant workflow:** Complete Patient Encounter.
- **Actual source:** `care/config/settings/config.py` - `ENCOUNTER_RESTART_TIME_LIMIT_HOURS`, default `0`; `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.restart`; `care/care/emr/tests/test_encounter_api.py` - `test_restart_completed_encounter`, `test_restart_expired_encounter`.
- **How to test:** Override the setting to a positive test value such as `24`, then test modified times at exactly `24` hours, just inside the limit, just outside the limit and much older. Test an in-progress encounter and an unauthorized user. Do not assume the default is `24`; source code defines the default as `0`, while the existing upstream test sets `24` only inside the test.