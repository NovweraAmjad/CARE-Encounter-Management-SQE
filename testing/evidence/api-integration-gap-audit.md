# API and Integration Gap Audit - CARE Encounter Management

## 1. Scope and evidence basis

This Phase 1 audit covers the actual Encounter API registered in
`care/config/api_router.py` and implemented by
`care/care/emr/api/viewsets/encounter.py`.

The audited endpoints are:

- `POST /api/v1/encounter/`
- `GET /api/v1/encounter/{id}/`
- `PUT /api/v1/encounter/{id}/`
- `POST /api/v1/encounter/{id}/restart/`

Source fields are derived from `EncounterCreateSpec`,
`EncounterUpdateSpec`, `EncounterSpecBase`, `PeriodSpec`,
`StatusChoices`, `ClassChoices`, `EncounterPriorityChoices`,
`COMPLETED_CHOICES`, `MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY`,
and `ENCOUNTER_RESTART_TIME_LIMIT_HOURS`.

Existing evidence is current only when explicitly distinguished:

- Independent Django suite: 31 passed, 0 failed, 0 skipped.
- Existing upstream encounter API suite: 51 passed in the earlier executed run.
- Independent restart suite: 4 passed, 0 failed, 0 skipped.
- The test register and traceability matrix are planning/execution records, not
  evidence that an unexecuted test passed.

## 2. Endpoint input audit

| Endpoint / input | Valid equivalence partition | Invalid equivalence partition | Boundary values | Existing test IDs | Executable and passed evidence | Missing coverage |
|---|---|---|---|---|---|---|
| POST `/api/v1/encounter/` - `patient` | Existing patient external UUID; valid UUID belonging to one patient | Valid UUID that does not exist; malformed/not-a-UUID value | None for UUID length | `UNIT-ENC-002`, `API-ENC-001`, `API-ENC-002` | Valid create and nonexistent patient API cases passed; malformed UUID not recorded in independent suite | Add one malformed/non-UUID partition test so Pydantic UUID rejection is separate from nonexistent patient validation |
| POST `/api/v1/encounter/` - `facility` | Existing facility external UUID | Valid UUID that does not exist; malformed/not-a-UUID value | None for UUID length | `UNIT-ENC-003`, `API-ENC-001`, `API-ENC-002` | Valid create and nonexistent facility API cases passed; malformed UUID not recorded | Add one malformed/non-UUID facility test |
| POST `/api/v1/encounter/` - `status` | Implemented status enum values: planned, in_progress, on_hold, discharged, completed, cancelled, discontinued, entered_in_error, unknown | Unknown string or wrong JSON type | No numeric boundary | `UNIT-ENC-014`, upstream status update tests | Invalid status Pydantic unit test passed; create/update API negative status tests are incomplete | Add separate API create/update tests for one invalid status string and wrong type |
| POST `/api/v1/encounter/` - `encounter_class` | `imp`, `amb`, `obsenc`, `emer`, `vr`, `hh` | Unknown class string or wrong JSON type | No numeric boundary | Creation tests use `imp`/frontend upstream classes | Valid class coverage exists; no independent invalid API partition | Add one unknown class and one wrong-type API negative test |
| POST `/api/v1/encounter/` - `priority` | All values in `EncounterPriorityChoices` | Unknown priority string or wrong JSON type | No numeric boundary | Integration payload uses `routine`; upstream test uses mixed values | Valid priority passed in existing API tests; invalid priority API partition missing | Add one unknown priority and one wrong-type API negative test |
| POST `/api/v1/encounter/` - `organizations` | Existing facility organization UUID list; empty list is permitted by create spec | Organization UUID not existing; organization outside selected encounter facility; duplicate UUIDs are deduplicated | Empty list and repeated list length; no defined maximum length | Existing integration payload includes one valid organization | Valid organization creation passed as part of API suite; outside-facility, nonexistent and duplicate behavior not covered | Source supports list UUIDs and perform-create compatibility checks. Add executable cases for nonexistent UUID and organization from another facility; verify duplicates do not create duplicate links |
| POST `/api/v1/encounter/` - `appointment` | Existing booking for the patient, facility and resource | Wrong patient, wrong facility, booking with associated encounter, malformed UUID, nonexistent UUID | Optional null versus present UUID | No independent API test ID currently | Not executed in independent suite | Add equivalence and negative tests only for conditions implemented by `perform_extra_deserialization` and `perform_create`; verify associated booking is set or rejected |
| POST/PUT - `period.start` | Existing timezone-aware start; null/absent start is allowed by `PeriodSpec` | Naive datetime; wrong datetime type | No period start/end ordering boundary: start > end | `UNIT-ENC-015`, `UNIT-ENC-016`, `API-ENC-008`, `API-ENC-009` | Passed | Add API test for missing start if update/create behavior must be verified; retain awareness and ordering tests |
| POST/PUT - `period.end` | Timezone-aware end equal to or after start; null/absent end | Naive datetime; wrong datetime type; end before start | End equal to start; start/end one instant apart | `UNIT-ENC-017`, `UNIT-ENC-018`, `UNIT-ENC-019`, `API-ENC-008`, `API-ENC-009` | Passed | Add end-equal-to-start API boundary and confirm persisted values; backend does not populate missing end |
| POST/PUT - `hospitalization` | Each optional field in its enum or null | Unknown enum value or wrong JSON type | No documented length/count boundary | No independent API test ID | Not executed | Add one invalid enum test if the selected rule scope includes the full EncounterCreate/Update spec; this is outside BR-ENC-05 but applicable API input |
| POST/PUT - `external_identifier` | String or null | Wrong JSON type/over-length length is not source-documented | Field has `max_length=100`; source Django field and Pydantic spec; exact boundary 100/101 characters can be tested | No independent test ID | Not executed | Add 100-character valid and 101-character invalid API/validation tests if DRF/Pydantic exposes that source limit |
| POST/PUT - `discharge_summary_advice` | String or null | Wrong JSON type | TextField has no source-defined maximum | No independent test ID | Not executed | No length boundary is supported by source; type validation is enough if tested |
| PUT `/api/v1/encounter/{id}/` - `id` | Existing encounter external UUID | Valid UUID that does not exist; malformed UUID | None for UUID length | Retrieval/update upstream tests | Existing update tests pass for valid/existing; nonexistent/malformed detail input missing | Add nonexistent and malformed detail-ID partition tests |
| PUT `/api/v1/encounter/{id}/` - status/history | Status enum; changed status appends one history entry; unchanged status appends none | Invalid status; wrong type | Boolean-like old-status-different boundary: true/false | `UNIT-ENC-012`, `UNIT-ENC-013`, `UNIT-ENC-014`, `API-ENC-003`, `API-ENC-004` | Executed and passed | Preserve; add rejected update read-back for invalid status |
| PUT - request period/persistence | Existing start/end preserved; missing end remains null/absent | Naive start/end; end before start | start=end valid boundary; start>end invalid | `UNIT-ENC-015`-`UNIT-ENC-019`, `API-ENC-008`, `API-ENC-009` | Executed and passed | Rejected invalid update read-back is covered for start>end |
| GET `/api/v1/encounter/{id}/` - `id`, `facility`, `patient` | Existing external UUID for each context | Malformed UUID, nonexistent encounter/patient/facility or mismatched context | No defined length/count boundary | Upstream retrieve tests | Executed upstream 51 suite included valid/invalid permission cases | Add independent API nonexistent/mismatched context tests only if not duplicated |
| GET `/api/v1/encounter/` - filters | Facility UUID, patient UUID, status selection, encounter class, priority, location UUID, dates, live, organization, care-team username | Invalid UUID, unknown enum/filter values, malformed date range | Filter date ranges and status/count boundaries | 51 upstream tests cover many filters | Executed upstream suite passed earlier | Independent tests should avoid duplicating upstream filter tests; missing coverage should focus selected create/restart/rule inputs |
| POST `/api/v1/encounter/{id}/restart/` - `id` | Existing encounter external UUID | Valid UUID that does not exist; malformed UUID | None for UUID length | No independent nonexistent/malformed ID test | Missing | Add two negative partition tests |
| POST `/api/v1/encounter/{id}/restart/` - authorization | Superuser or role with restart write permission | Unauthenticated user and user without permission | No numeric boundary | `API-ENC-012`, upstream restart unauthorized test | Executed/passed in independent and upstream suites | Preserve; no duplicate |
| POST restart - status | Every value in `COMPLETED_CHOICES` | Any status outside terminal choices | Completed/non-completed two-value partition | `API-ENC-005`, `API-ENC-010`, upstream restart tests | Executed/passed | Preserve |
| POST restart - `modified_date` / configured limit | Age less than limit, exactly equal, greater than limit | Far expired; no separate invalid type because this is server-managed | Just inside: limit-1 minute; exactly limit; just outside: limit+1 minute; far outside | `API-ENC-005`, `API-ENC-011`, upstream expired test | Executed/passed using override 24 hours | Actual setting default is 0; test should continue to override explicitly and read back status, updated_by and modified_date |

## 3. Selected business-rule API audit

### BR-ENC-01 - active maximum

Existing executable evidence:

- `API-ENC-001`: active counts 0, 4, 5 and 6.
- `API-ENC-002`: active statuses and terminal statuses.
- Unit coverage also verifies create-versus-update and missing UUID behavior.

Gaps:

- Separate 3-point numerical boundary for count is covered as 4/5/6 only if
  the configured maximum is 5. A test that derives limit and tests
  `limit-1`, `limit`, `limit+1` is preferable to hardcoded values.
- Just-below, exactly-at and just-above for a configured limit other than 5
  should be generated dynamically.
- Rejected creation must assert there is no extra Encounter row persisted.
- Terminal status partition currently uses `COMPLETED_CHOICES`, but
  `discharged` is not in that list. The terminal-status rule for counting
  should continue to use the source list and not call it every possible status.

### BR-ENC-03 - status history

Existing executable evidence:

- `API-ENC-003`: changed status persists one appended entry.
- `API-ENC-004`: unchanged status does not duplicate history.

Gaps:

- Invalid status API rejection and unchanged database state.
- Invalid status update should confirm status and history remain unchanged.
- Initial create history currently covered in unit tests and upstream create tests,
  but an independent create API test should read it back where feasible.

### BR-ENC-05 - period

Existing executable evidence:

- `API-ENC-008`: missing and existing end.
- `API-ENC-009`: start greater than end rejection.

Gaps:

- Missing-period update behavior is not independently distinguished:
  `period` absent versus `period: {}` versus null may be accepted differently
  by Pydantic. Source has `PeriodSpec = {}`, but the exact API behavior depends
  on deserialization.
- End equal to start is a 3-point/equality boundary.
- Naive start and naive end API negative tests remain missing.
- Rejected request read-back for missing/naive/end-before-start is incomplete.

### BR-ENC-06 - restart

Existing executable evidence:

- `API-ENC-005`: every completed choice and 24-hour just inside/at/outside/far
  boundaries.
- `API-ENC-010`: view-level non-completed status branch.
- `API-ENC-011`: restart time boundaries.
- `API-ENC-012`: unauthorized user.

Gaps:

- Exactly at limit is covered as 24 hours in one test by overriding setting.
- If the test is rewritten, it should derive limit from
  `settings.ENCOUNTER_RESTART_TIME_LIMIT_HOURS` rather than keeping a duplicated
  hardcoded 24.
- Normal authorization for non-completed status should assert 403 and no view
  status guard branch, while the isolated patch test asserts view 400.
- Successful restart database read-back for every terminal status is not
  consistently verified for `modified_date` and `updated_by` across all rows.
- There is no nonexistent/malformed restart encounter ID test.

## 4. EP and BVA implementation priorities

Priority 1:

1. Dynamically derive active-limit boundary tests for `limit-1`, `limit`,
   `limit+1`.
2. Add invalid status API tests for create and update.
3. Add malformed UUID tests for patient, facility and encounter ID.
4. Add naive start/end and end-equal-to-start API tests.
5. Add nonexistent and malformed restart ID tests.

Priority 2:

1. Add nonexistent/wrong-facility/duplicate organization tests.
2. Add wrong-patient/wrong-facility appointment tests.
3. Add existing-over-limit patient/facility count read-back assertions.
4. Add invalid encounter period read-back checks for naive start/end.

Priority 3:

1. Expand OpenAPI inputs for organizations, appointment, period, hospitalization,
   external identifier and discharge summary advice if the specification is intended
   to be implementation-complete.
2. Avoid duplicating upstream GET filter tests.
3. Keep browser E2E separate from API/integration scope.

## 5. Current gap conclusion

The existing independent API suite already has executable pass evidence for:

- active encounter boundary and terminal/status partitions;
- status-history changed/unchanged persistence;
- existing/missing period and invalid period ordering;
- restart terminal statuses, time boundaries and authorization.

The main missing API partitions are malformed UUIDs, invalid enum/status values,
appointment/organization edge cases, date-aware/equal period boundaries and
restart nonexistent/malformed IDs.

Additional implementation status:

- Malformed patient/facility UUID tests: implemented.
- Malformed/nonexistent encounter detail and restart IDs: implemented.
- Invalid status/class/priority and hospitalization values: implemented.
- Dynamic active-limit three-point boundary: implemented using regenerated limit 3.
- Organization duplicate and wrong-facility compatibility: implemented.
- Appointment nonexistent and associated-booking rejection: implemented.
- Naive/equal/start-after-end period behavior: implemented.
- Repeated create/status/restart behavior: implemented.
- Supported state transitions: implemented without inventing a prohibited matrix.
- 101-character external identifier behavior: implemented and confirmed as an
  uncaught database 500 weakness.

Remaining possible expansions are browser E2E behavior and full upstream GET-filter
coverage. These are outside independent API/integration scope and should not be
duplicated unless new negative/filter partitions are identified.
