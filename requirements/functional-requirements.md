## Functional Requirements - Encounter Management

### FR-ENC-01 - Create a patient encounter

- **Description:** An authorized clinical user can create an encounter for a selected patient and facility.
- **Actor/role:** A user with `EncounterPermissions.can_create_encounter` for the facility organization.
- **Preconditions:** The user is authenticated; a valid patient and facility exist; the user has create permission; at least one organization/department is selected by the frontend form.
- **Expected result:** `POST /api/v1/encounter/` accepts the request and returns the created encounter. The encounter is linked to the selected patient and facility and has the submitted status, encounter class and priority.
- **Source basis:** `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.authorize_create`, `perform_create`, `validate_data`; `care/care/emr/resources/encounter/spec.py` - `EncounterCreateSpec`; `care_fe/src/components/Encounter/CreateEncounterForm.tsx`.

### FR-ENC-02 - Restrict creation by active encounter limit

- **Description:** The backend must prevent creation when the patient already has the configured maximum number of active encounters in the selected facility.
- **Actor/role:** Authenticated user attempting to create the encounter.
- **Preconditions:** The patient and facility are valid and the user has creation permission.
- **Expected result:** The backend counts encounters for the patient and facility that are not in `COMPLETED_CHOICES`. If the count is greater than or equal to `MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY`, creation is rejected with a validation error. The default limit is `5`.
- **Source basis:** `care/config/settings/config.py` - `MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY`; `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.validate_data`; `care/care/emr/resources/encounter/constants.py` - `COMPLETED_CHOICES`.

### FR-ENC-03 - Validate encounter creation fields

- **Description:** The frontend and backend must use valid encounter status, class and priority values and must reject an invalid start-date combination.
- **Actor/role:** User creating an encounter.
- **Preconditions:** The encounter form is open for a patient and facility.
- **Expected result:** The frontend offers statuses `planned`, `in_progress` and `on_hold`, the configured encounter classes and configured priorities. A start date in the future is rejected unless the status is `planned`. The backend Pydantic resources also enforce enum values and require a patient, facility, status, encounter class and priority.
- **Source basis:** `care_fe/src/components/Encounter/CreateEncounterForm.tsx` - `encounterFormSchema`; `care/care/emr/resources/encounter/spec.py` - `EncounterSpecBase`, `EncounterCreateSpec`; `care/care/emr/resources/encounter/constants.py`.

### FR-ENC-04 - Display a created encounter

- **Description:** After successful creation, the frontend must show a success message, refresh the encounter list and navigate to the new encounter's Updates tab.
- **Actor/role:** User who created the encounter.
- **Preconditions:** `POST /api/v1/encounter/` has returned a valid encounter.
- **Expected result:** The success message is displayed, the encounter sheet closes, patient encounter queries are invalidated, and the browser navigates to `/facility/{facilityId}/patient/{patientId}/encounter/{encounterId}/updates`.
- **Source basis:** `care_fe/src/components/Encounter/CreateEncounterForm.tsx` - `useMutation` and `onSuccess`; `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx`.

### FR-ENC-05 - Retrieve encounter details

- **Description:** An authorized user can retrieve a specific encounter and receive its patient, facility, status, period, priority and permission data.
- **Actor/role:** User with patient or encounter view authorization.
- **Preconditions:** The encounter exists and the request supplies the encounter external ID plus `facility` and `patient` query parameters.
- **Expected result:** `GET /api/v1/encounter/{id}/` returns `200` with the encounter details. An unauthorized user receives `403` with the implemented permission denial.
- **Source basis:** `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.authorize_retrieve`; `care/care/emr/resources/encounter/spec.py` - `EncounterRetrieveSpec`; `care/care/emr/tests/test_encounter_api.py`.

### FR-ENC-06 - Mark an eligible encounter as completed

- **Description:** A user with update permission can mark an encounter as `completed`.
- **Actor/role:** User with `EncounterPermissions.can_write_encounter` or the clinical update permission required by the selected workflow.
- **Preconditions:** The encounter exists and the user has update authorization.
- **Expected result:** The frontend sends an encounter update through the shared batch mechanism. The backend accepts `status: "completed"` and returns a successful encounter response with status `completed`. The status history records the new status.
- **Source basis:** `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` - `addEncounterCloseRequestToBatch`; `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.authorize_update`, `perform_update`; `care/care/emr/resources/encounter/spec.py` - `EncounterUpdateSpec`.

### FR-ENC-07 - Complete an inpatient encounter through discharge

- **Description:** The frontend must route an inpatient encounter (`encounter_class = imp`) that is not yet discharged to the encounter discharge questionnaire instead of immediately completing it.
- **Actor/role:** User with permission to update the selected encounter.
- **Preconditions:** The selected encounter is inpatient and its status is not `discharged`.
- **Expected result:** Selecting mark complete opens or navigates to the encounter questionnaire with `toDischarge=true`; completion is not submitted as `completed` on that first step.
- **Source basis:** `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` - `encounterRequiresDischarge`, `completeEncounter`, `completeEverything`; `care_fe/src/pages/Encounters/MarkEncounterAsCompletedDialog.tsx`.

### FR-ENC-08 - Set the completion end period

- **Description:** When completing from the frontend, the encounter period's end value must be set to the existing end value or the current ISO timestamp.
- **Actor/role:** User completing an encounter.
- **Preconditions:** The encounter has been retrieved and is eligible for completion; the frontend batch update is submitted.
- **Expected result:** The update body preserves the existing start time and sets `period.end` to the existing end time if present, otherwise the current browser timestamp.
- **Source basis:** `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` - `addEncounterCloseRequestToBatch`.

### FR-ENC-09 - Prevent unauthorized completion

- **Description:** A user without update authorization must not be allowed to change the encounter status.
- **Actor/role:** User without `can_write_encounter` or the applicable encounter update permission.
- **Preconditions:** The encounter exists and the requesting user is authenticated.
- **Expected result:** `PUT /api/v1/encounter/{id}/` and the corresponding frontend completion action are denied or not exposed. The backend returns `403` with “You do not have permission to update encounter”.
- **Source basis:** `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.authorize_update`; `care/care/emr/tests/test_encounter_api.py` - `test_update_encounter_without_permissions`.

### FR-ENC-10 - Restart only an eligible completed encounter

- **Description:** An authorized user can restart a completed encounter as `in_progress` only if the encounter is completed and within the configured restart time limit.
- **Actor/role:** User passing the `can_restart_encounter_obj` authorization check.
- **Preconditions:** The encounter status is in `COMPLETED_CHOICES`; the elapsed time since `modified_date` is within `ENCOUNTER_RESTART_TIME_LIMIT_HOURS`.
- **Expected result:** `POST /api/v1/encounter/{id}/restart/` changes status to `in_progress` and returns `204`. Non-completed, unauthorized or expired encounters are rejected by the implemented conditions.
- **Source basis:** `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.restart`; `care/config/settings/config.py` - `ENCOUNTER_RESTART_TIME_LIMIT_HOURS`; `care/care/emr/tests/test_encounter_api.py`.