# CARE Encounter API and Integration Execution Results

## Environment

- Backend: existing Docker `care-backend-1`
- Python: 3.13.18
- Django: 6.0
- Pydantic: 2.12.5
- Database: PostgreSQL test database `test_care`
- Independent tests were copied to `/tmp/care_testing` because root `testing/`
  is not mounted in the existing Compose configuration.

No production source, upstream test, Docker Compose or Git history was modified.

## Exact commands

Complete independent unit, API/integration and generator suite:

```powershell
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'rm -rf /tmp/care_testing'
docker cp .\testing care-backend-1:/tmp/care_testing
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.unit care_testing.integration care_testing.generators --keepdb --verbosity=1'
```

Generator-only suite:

```powershell
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.generators.test_encounter_generator --keepdb --verbosity=1'
```

Expanded appointment association test:

```powershell
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.integration.test_encounter_server_rules.EncounterServerRuleIntegrationTests.test_nonexistent_and_wrong_appointment_associations --keepdb --verbosity=2'
```

## Results

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Complete independent unit/API/generator suite | 49 | 0 | 0 |
| Generator-only suite | 3 | 0 | 0 |
| Expanded wrong-patient/wrong-facility appointment association test | 1 | 0 | 0 |

The 49-test run includes 31 previously completed unit/integration tests plus newly
expanded API/integration and generator cases.

## EP and BVA results

- EP: malformed and nonexistent UUID; invalid status/class/priority; terminal/active
  status; organization duplicate/wrong-facility; appointment; period; restart
  status/time/authorization partitions executed.
- Active encounter BVA: `limit-1`, `limit`, `limit+1` consumed by the API suite using
  a regenerated limit of 3.
- Restart BVA: exactly at limit, just inside, just outside and far outside retained
  by the existing 24-hour override test.
- Period BVA: aware, naive, missing, equal and start-after-end cases executed.
- External identifier BVA: 100-character and 101-character values consumed; the
  101-character request demonstrated a database 500 response.

## Decision tables and state transitions

- Appointment, organization and repeated request behavior was exercised.
- Appointment association tests cover nonexistent, already-associated,
  wrong-patient and wrong-facility bookings.
- Status transition cases included planned→in_progress, in_progress→on_hold,
  on_hold→completed and completed→in_progress.
- The completed→in_progress PUT was rejected with 403; restart is the actual
  supported route back to in-progress.
- No arbitrary prohibited transition matrix was assumed.

## Repeated requests and database read-back

- Repeated create at limit 1 rejected the second create and preserved the row count.
- Repeated completed status update returned 403 and did not add history.
- Repeated restart returned 204 then 403 and left status `in_progress`.
- Duplicate organization UUID created one EncounterOrganization row.
- Invalid enum and period requests preserved existing encounter status, history and period.

## Generator proof

The generator:

- reads status/class/priority constraints and test limits from the OpenAPI YAML;
- produces deterministic payload values when period is left empty;
- produces one invalid value per negative partition;
- writes
  `testing/evidence/two-constraint-regeneration.json`;
- consumes regenerated active-limit 2/3/4 values in
  `test_dynamic_active_limit_boundary_below_equal_above`;
- consumes regenerated external identifier lengths 12/13 in the generator suite.

The original and regenerated constraint evidence is in
[two-constraint-regeneration.json](./two-constraint-regeneration.json).
