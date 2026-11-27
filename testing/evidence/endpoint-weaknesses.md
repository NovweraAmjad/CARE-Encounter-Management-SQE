# Encounter API Endpoint Weakness Evidence

## Confirmed weaknesses demonstrated by executable tests

### EW-01 - External identifier over-length database failure

The OpenAPI test specification declares `external_identifier.maxLength: 100`.
An API POST with 101 characters returned HTTP 500 and logged
`psycopg.errors.StringDataRightTruncation: value too long for type character varying(100)`.

Evidence:

- Test method: `test_invalid_hospitalization_enum_and_external_identifier_length`
- Register ID: `API-ENC-014`
- No confirmed partial Encounter row was read back for the rejected 101-character request.

This is a validation weakness: the Pydantic/API layer does not convert the database
length constraint into a 400 response before persistence.

### EW-02 - Null period or hospitalization behavior may reach persistence

A period value of `null` or `{}` was exercised through update; an earlier run using
`hospitalization: null` confirmed a database not-null integrity weakness on
`emr_encounter.hospitalization`, producing HTTP 500 via an uncaught
`IntegrityError`.

The final test setup uses `hospitalization: {}` to isolate period behavior and avoid
this separate persistence weakness.

Evidence:

- Test ID: `API-ENC-024`
- Source: `Encounter` model and `HospitalizationSpec`/`EncounterUpdateSpec`.

### EW-03 - Repeated completed status update is denied after completion

A repeated PUT of `status: completed` returned 403 rather than 200 on the second
request because the existing encounter is already terminal.

This is safe handling: no duplicate history entry was observed.

Evidence:

- Test ID: `API-ENC-017`
- Method: `test_repeated_create_update_and_duplicate_relationship_behavior`

### EW-04 - Repeated restart is denied after first success

The first restart returned 204; the second returned 403 because the encounter status
changed to `in_progress`. No duplicate restart transition was persisted.

Evidence:

- Test ID: `API-ENC-026`
- Method: `test_repeated_restart_is_not_applied_twice`

### EW-05 - Duplicate organization UUID list is deduplicated

The create specification converts organizations to a set before persistence.
Repeated organization UUIDs created only one `EncounterOrganization` relation.

This is confirmed safe duplicate handling, not a weakness.

Evidence:

- Test ID: `API-ENC-015`
- Method: `test_organization_duplicate_and_wrong_facility_behavior`

## Recommendations, not confirmed defects

- Add explicit Pydantic `max_length=100` validation for `external_identifier`.
- Convert unexpected database integrity errors into HTTP 400 validation responses.
- Document whether `period: null`, `period: {}`, `hospitalization: null` and
  `hospitalization: {}` are supported API inputs.
- Define and publish the exact valid old-to-new encounter status transition matrix
  only if one is intentionally supported.

## Untested behavior

- Full GET-filter equivalence coverage remains mostly in the upstream encounter suite.
- Browser completion behavior is out of this API/integration scope.
- The production Web/API response for external identifier 101 is environment-dependent
  in test setup; the observed database error is recorded as confirmed in this run.
