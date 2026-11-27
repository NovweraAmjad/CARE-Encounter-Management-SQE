# Independent Encounter Test Execution Evidence

## Environment

- CARE backend service: `care-backend-1`
- Working directory: `/app`
- Python: 3.13.18
- Django: 6.0
- Pydantic: 2.12.5
- Coverage.py: 7.13.0
- Database: PostgreSQL; test database `test_care`
- Independent test package: temporarily copied to `/tmp/care_testing` because the root
  `testing/` directory is not mounted into the backend container.

The root test directory was not mounted by either existing Compose file. No Compose,
Docker or upstream source configuration was modified.

## Commands

Existing upstream encounter suite:

```powershell
docker compose -f .\docker-compose.yaml -f .\docker-compose.local.yaml exec backend bash -lc '/.venv/bin/python manage.py test care.emr.tests.test_encounter_api --settings=config.settings.test --keepdb --verbosity=1'
```

Independent Django suite:

```powershell
docker cp .\testing care-backend-1:/tmp/care_testing
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.unit care_testing.integration --keepdb --verbosity=2'
```

Independent frontend suite:

```powershell
cd care_fe
node --import tsx --test '..\testing\frontend\test_encounter_frontend_rules.ts'
```

## Results

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Existing upstream `test_encounter_api` | 51 | 0 | 0 |
| Independent Django unit/API suite | 31 | 0 | 0 |
| Independent frontend rule suite | 3 | 0 | 0 |

The upstream suite result establishes existing coverage. It does not prove that new
independent tests passed; the independent suite is separately reported above.

## Coverage

Coverage was measured while running the independent Django suite:

- Whole scoped modules:
  - `care/emr/api/viewsets/encounter.py`: 245 statements, 72 branches, 50% total coverage.
  - `care/emr/resources/base.py`: 140 statements, 58 branches, 83% total coverage.
  - `care/emr/resources/encounter/spec.py`: 115 statements, 18 branches, 83% total coverage.
  - Combined three modules: 500 statements, 148 branches, 67% total coverage.
- Selected business-rule functions:
  - BR-ENC-01 `EncounterViewSet.validate_data`: 8/8 statements, 8/8 branches.
  - BR-ENC-03 `EncounterCreateSpec.perform_extra_deserialization`: 7/7 statements, 4/4 branches.
  - BR-ENC-03 `EncounterUpdateSpec.perform_extra_deserialization`: 5/5 statements, 4/4 branches.
  - BR-ENC-05 `PeriodSpec.validate_period`: 7/7 statements, 6/6 branches.
  - BR-ENC-05 `EncounterViewSet.perform_update`: 4/4 statements, no branches.
  - BR-ENC-06 `EncounterViewSet.restart`: 12/12 statements, 6/6 branches.

Coverage files are stored in `testing/coverage/coverage.json` and
`testing/coverage/coverage.xml`.

## Limitations

- BR-ENC-02 is not fully behavior-executed in a browser test by this source contract
  test. The inline Zod schema is not exported from `CreateEncounterForm.tsx`.
- BR-ENC-05 is not fully behavior-executed by the independent frontend unit test.
  `addEncounterCloseRequestToBatch` is nested inside `useEncounterProgressController`.
  Its source contract is checked, and backend period persistence is API-tested.
- Coverage.py measures statement and branch coverage but not MCC or MC/DC.
  MCC and MC/DC evidence is documented in `testing/coverage/mcc-mcdc.md`.
- Browser E2E completion and creation tests remain planned unless separately run in
  the Playwright environment.
