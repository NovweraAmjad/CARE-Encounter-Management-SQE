# Test Basis

## Scope

This document identifies existing source-code specifications and upstream tests that form the test basis for:

1. Creating a patient encounter.
2. Completing an existing patient encounter.

The categories in this document are separate:

- **Source inspection** means a file or implementation was read.
- **Upstream test evidence** means the repository contains a test case or Playwright specification, but it is not claimed that this assignment executed or passed it.
- **Assumption** means a future test setup detail that is not established by source inspection.

No application behavior experiment or assignment test run is claimed here.

## Existing backend tests

The main encounter API test file is `care/care/emr/tests/test_encounter_api.py`. The `EncounterAPITests` class inherits `CareAPITestBase`, which provides synthetic users, facilities, patients, organizations, roles and encounters in `care/care/utils/tests/base.py`.

### Creation and validation coverage

- `test_validate_data_max_encounters` - verifies that the configured active-encounter limit rejects excess creation.
- `test_validate_data_patient_not_exists` - verifies a missing patient UUID is rejected.
- `test_validate_data_facility_not_exists` - verifies a missing facility UUID is rejected.
- `test_create_encounter_with_permissions` - creates an encounter and retrieves it after using a role with create/read permissions.
- `test_create_encounter_without_permissions` - verifies creation returns `403`.

### Retrieval and filtering coverage

- `test_retrieve_encounter_with_permissions` - verifies retrieval for an authorized role.
- `test_retrieve_encounter_without_permissions` - verifies retrieval returns `403` for an unauthorized user.
- Facility, status, patient name, phone, location, live-status, external identifier, encounter class, priority and patient filters are covered by tests in the same file.
- `test_filter_encounter_without_patient_and_facility` verifies that the list endpoint rejects a request without the expected patient/facility access context.

### Completion and update coverage

- `test_update_encounter_with_permissions` - changes encounter status to `completed`, retrieves it and confirms the stored status.
- `test_update_encounter_without_permissions` - verifies unauthorized status update returns `403`.

### Restart coverage

- `test_restart_completed_encounter` - with an overridden restart window of 24 hours, verifies completed → `in_progress`.
- `test_restart_non_completed_encounter` - verifies a non-completed encounter cannot restart.
- `test_restart_encounter_without_permission` - verifies restart authorization.
- `test_restart_expired_encounter` - verifies the configured time window blocks restart.

### Existing test gap from source inspection

The upstream file does not contain a dedicated end-to-end browser test for every completion dialog step. It provides backend update and restart coverage, while frontend Playwright tests cover encounter creation and many encounter screen behaviors.

## Existing frontend Playwright tests

The main upstream creation specification is `care_fe/tests/facility/patient/encounter/encounter.spec.ts`.

It tests:

- Opening encounter creation from the patient home.
- Selecting a random encounter class.
- Creating through the phone-number/year-of-birth patient verification flow.
- Selecting status and priority.
- Seeing a success message.
- Seeing the created encounter on the encounter page.
- Opening the edit link and confirming status and priority values.

The nearby encounter Playwright specifications also cover relevant context:

- `care_fe/tests/facility/patient/encounter/encounterFutureDateRestriction.spec.ts` - future start-date behavior.
- `care_fe/tests/facility/patient/encounter/encounterPlannedStatusTransition.spec.ts` - planned encounter/status behavior.
- `care_fe/tests/facility/patient/encounter/encounterFilterScope.spec.ts` - encounter filter and permission scope.
- `care_fe/tests/facility/patient/encounter/encounterDepartmentAssociation.spec.ts` - department/organization association.
- `care_fe/tests/facility/patient/encounter/encounterDepartmentSelection.spec.ts` - department selection.
- `care_fe/tests/facility/patient/encounter/encounterNavigation.spec.ts` - encounter navigation.
- `care_fe/tests/facility/patient/encounter/encounterWorkspace.spec.ts` - encounter workspace behavior.
- `care_fe/tests/facility/encounters/encounterFilterSelection.spec.ts` - encounter list status filtering.

The Playwright configuration is `care_fe/playwright.config.ts`. It defines the test directory, browser projects, timeout, retry, reporting and web-server behavior. Authentication for browser tests is initialized through `care_fe/tests/globalSetup.ts`, which refreshes saved JWT storage states and restores a database snapshot locally when one exists.

## Source-code documentation/specifications used

### Backend

- `care/care/emr/models/encounter.py` - Django `Encounter` fields and cache synchronization.
- `care/care/emr/resources/encounter/constants.py` - status, class, priority and completed-choice definitions.
- `care/care/emr/resources/encounter/spec.py` - Pydantic create/update/list/retrieve resources and status-history logic.
- `care/care/emr/api/viewsets/encounter.py` - endpoint behavior, validation, permissions, updates and restart action.
- `care/care/security/permissions/encounter.py` - encounter permission names and role groups.
- `care/config/api_router.py` - Encounter ViewSet route registration.
- `care/config/settings/config.py` - active-encounter limit and restart time-limit settings.

### Frontend

- `care_fe/src/components/Encounter/CreateEncounterForm.tsx` - creation form, validation and redirect.
- `care_fe/src/types/emr/encounter/encounterApi.ts` - frontend API paths.
- `care_fe/src/types/emr/encounter/encounter.ts` - status, class and priority types.
- `care_fe/src/routes/_app/facility.$facilityId.encounters.tsx` - encounter overview route.
- `care_fe/src/routes/_app/facility.$facilityId.patient.$patientId.encounter.$encounterId.$tab.tsx` - encounter detail route.
- `care_fe/src/pages/Encounters/MarkEncounterAsCompletedDialog.tsx` - completion confirmation UI.
- `care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts` - direct completion, inpatient discharge routing and optional appointment/token closure.
- `care_fe/src/pages/Encounters/utils/EncounterProvider.tsx` - action and permission wiring.

## Necessary assumptions

The following items are assumptions for future test design and are not claims from a source-only inspection:

1. The test environment can run the frontend and backend together and provide a PostgreSQL database and required services.
2. The exact positive restart limit used in an implementation test will be explicitly configured; source code has a default of `0` and the upstream test overrides it to `24`.
3. A user is considered authorized when the role attached to the relevant facility organization contains the required permission; exact role assignment depends on test fixtures.
4. Browser completion is expected to use the implemented batch request path if it includes an appointment or token and to use a direct encounter update for a non-discharge encounter.
5. No existing source test establishes a formal old-to-new status-transition allowlist. Therefore, a transition test may verify enum validity and observed status-history behavior but must not claim that an undocumented transition matrix exists.