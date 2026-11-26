# Workflow Specification - Encounter Management

## Workflow 1 - Create Patient Encounter

### Starting condition

The user has opened a patient context and may create an encounter. Upstream screens use `CreateEncounterForm`, including the Patient Home, Patient Encounter History and referral/appointment screens.

### Actor/role

A user who has encounter creation permission for the facility organization. The frontend obtains this capability as `canCreateEncounter`; the backend additionally checks `EncounterPermissions.can_create_encounter`.

### Preconditions

- The user is authenticated.
- A valid patient and facility exist.
- The patient is within the selected facility context.
- The user has encounter creation permission.
- The create form has at least one organization/department.
- The patient has fewer than the configured number of active encounters. The default is `5`.

### Step-by-step user actions

1. Navigate to `/facility/{facilityId}/patient/{patientId}` or open the encounters overview, then open the Create Encounter action.
2. Open `CreateEncounterForm`.
3. Select an encounter class.
4. Select status: `planned`, `in_progress` or `on_hold`.
5. Select priority.
6. Confirm at least one department/organization.
7. Enter or confirm the start date.
8. Optionally select tags or use appointment/schedule defaults.
9. Submit using the Create Encounter button.

### Encounter data read

- Patient ID and name.
- Facility ID.
- Existing patient encounters and active encounter count, where enforced by the backend.
- Optional appointment ID and schedule defaults such as encounter type, organizations and care team.
- Encounter permissions for the user.

### Encounter data created or changed

- `patient`
- `facility`
- `organizations`
- `encounter_class`
- `status`
- `priority`
- `period.start`
- `tags`
- Optional `appointment`
- Optional `external_identifier`
- Optional `discharge_summary_advice`
- Initial `status_history` entry

### Backend API endpoints

- `POST /api/v1/encounter/` - create the encounter.
- `GET /api/v1/encounter/{id}/` - retrieve the created encounter.
- `GET /api/v1/encounter/` - optionally list encounters or verify filtering.
- Authentication uses `POST /api/v1/auth/login/` and the JWT refresh endpoint under `/api/v1/auth/token/refresh/`.

### Frontend screens/routes

- Patient Home: `care_fe/src/pages/Patient/PatientHome.tsx`
- Patient Encounter History: `care_fe/src/components/Patient/PatientDetailsTab/EncounterHistory.tsx`
- Create form: `care_fe/src/components/Encounter/CreateEncounterForm.tsx`
- Encounter overview: `/facility/{facilityId}/encounters/...`
- Encounter detail: `/facility/{facilityId}/patient/{patientId}/encounter/{encounterId}/{tab}`
- Detail route implementation: `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx`

### Expected outcome

The encounter is persisted and linked to the patient and facility, an initial status-history entry is created, a success toast is shown, and the browser redirects to the new encounter's `updates` tab. The API returns the encounter read representation. Unauthorized, duplicate-limit and invalid-data requests are rejected by the implemented authorization or validation logic.

## Workflow 2 - Complete Patient Encounter

### Starting condition

The user opens an existing encounter whose status can be changed and selects the mark-complete action.

### Actor/role

A user who can update the selected encounter. Non-clinical and clinical write permissions are separated in the frontend/provider and backend permissions, so the exact permission depends on the field or action.

### Preconditions

- The encounter is loaded through `EncounterProvider`.
- The user has update authorization.
- For a normal encounter, no discharge questionnaire requirement is blocking completion.
- For an inpatient encounter, if `encounter_class` is `imp` and status is not `discharged`, the discharge questionnaire is required before direct completion.
- Optional appointment and token records may exist.

### Step-by-step user actions

1. Open `/facility/{facilityId}/patient/{patientId}/encounter/{encounterId}/{tab}`.
2. Read the encounter status, class, period and priority in the encounter header.
3. Select `Mark as Complete` or the discharge action from the encounter overview/actions area.
4. If the confirmation dialog appears, review the warning and confirm.
5. For an inpatient/non-discharged encounter, complete the encounter discharge questionnaire at `/facility/{facilityId}/patient/{patientId}/encounter/{encounterId}/questionnaire/encounter?toDischarge=true`.
6. After eligibility checks succeed, submit completion.
7. Observe the success notification and refreshed encounter data.

### Encounter data read

- Encounter ID and external ID.
- Encounter status and encounter class.
- `period.start` and `period.end`.
- Patient and facility IDs.
- Appointment and token data, if present.
- Update and clinical-data permissions.

### Encounter data created or changed

- `status` changes to `completed` in the direct completion request.
- `period.end` is set to the existing end or current browser timestamp.
- `status_history` appends a new status entry when old status differs.
- `updated_by` and `modified_date` are updated by the backend update processing.
- If `completeEverything` is used, an active associated appointment is updated to `fulfilled` and an active associated token is also updated to `fulfilled`.

### Backend API endpoints

- `GET /api/v1/encounter/{id}/` - retrieve the encounter.
- `PUT /api/v1/encounter/{id}/` - change encounter status and period.
- `POST /api/v1/batch_requests/` - frontend batch completion can submit encounter and optional appointment/token closure together.
- `POST /api/v1/encounter/{id}/restart/` - optional restart of an eligible completed encounter.
- The frontend also provides encounter API definitions in `care_fe/src/types/emr/encounter/encounterApi.ts`.

### Frontend screens/routes

- Encounter detail: `/facility/{facilityId}/patient/{patientId}/encounter/{encounterId}/{tab}`.
- Encounter route: `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx`.
- Completion dialog: `care_fe/src/pages/Encounters/MarkEncounterAsCompletedDialog.tsx`.
- Completion logic: `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts`.
- Encounter provider/action wiring: `care_fe/src/pages/Encounters/utils/EncounterProvider.tsx`.
- Overview action: `care_fe/src/pages/Encounters/tabs/overview/summary-panel-actions.tab.tsx`.

### Expected outcome

For a normal eligible encounter, the encounter status becomes `completed`, the period receives an end time, the status history records the change, and the UI refreshes to show completion. For inpatient encounters requiring discharge, the user is routed to the discharge questionnaire instead of changing status directly. An unauthorized completion receives a backend `403`.

## Shared Records Between the Workflows

The shared record is the **Encounter** row. Workflow 1 creates it through `POST /api/v1/encounter/`, and Workflow 2 retrieves and updates the same row through `GET /api/v1/encounter/{id}/` and `PUT /api/v1/encounter/{id}/`. There is no separate completion record; completion changes fields on the existing Encounter.

| Workflow / record | Records read | Records created or changed | Key source evidence |
|---|---|---|---|
| Workflow 1 - Create Patient Encounter | Patient; Facility; existing Encounter rows for the active-count check; optional Appointment; user permissions; selected Facility Organizations | Creates one Encounter; creates linked EncounterOrganization rows for the submitted organizations; initializes embedded `status_history`; may associate a submitted Appointment; may set tags and a care team | `care/care/emr/models/encounter.py` - `Encounter`; `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.validate_data`, `perform_create`; `care/care/emr/resources/encounter/spec.py` - `EncounterCreateSpec`; `care_fe/src/components/Encounter/CreateEncounterForm.tsx` |
| Workflow 2 - Complete Patient Encounter | Existing Encounter, including status, encounter class, period and permissions; optional linked Appointment and associated Token | Updates the Encounter's `status`, `period.end`, `status_history`, `updated_by` and `modified_date`; in the `completeEverything` frontend batch, may update an associated active Appointment to `fulfilled` and an associated active Token to `fulfilled` | `care/care/emr/api/viewsets/encounter.py` - `EncounterViewSet.authorize_update`, `perform_update`; `care/care/emr/resources/encounter/spec.py` - `EncounterUpdateSpec`; `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` |
| Shared record - Encounter | Workflow 2 reads the Encounter created by Workflow 1 | Workflow 2 changes the existing Encounter rather than creating a new Encounter | Encounter detail route and provider: `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx`, `care_fe/src/pages/Encounters/utils/EncounterProvider.tsx` |

### How Workflow 2 uses the record from Workflow 1

Workflow 1 stores the patient, facility, encounter class, status, priority and start period on the Encounter and creates an initial status-history entry. Workflow 2 loads this same Encounter by its external ID, uses its class and status to decide whether a discharge questionnaire is required, and submits an update to the same external-ID endpoint. The code sets `status = "completed"` and adds an end timestamp to `period` for direct frontend completion.

The following records are related but are **not automatically all modified**:

- `EncounterOrganization` rows are created during encounter creation for submitted organizations; completion does not create or remove them.
- Tags and care-team members may be created or attached by their specific frontend/API actions; the direct completion controller does not perform these actions.
- An Appointment and Token are changed only when the frontend uses `completeEverything` and the linked records are not already final/active.
- Completion does not create a second Encounter.