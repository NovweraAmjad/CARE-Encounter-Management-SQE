# CARE Encounter Testing

This directory contains independent testing work for the CARE Encounter Management
assignment. It does not modify `care/` or `care_fe/`.

## Structure

- `unit/`: direct tests for CARE classes and deserialization functions.
- `integration/`: Django API/database tests for Encounter viewset behavior.
- `frontend/`: independent tests for actual exported frontend logic and source contracts.
- `generators/`: synthetic encounter payload and boundary data.
- `coverage/`: Coverage.py configuration and MCC/MC/DC evidence.
- `evidence/`: test-case register and execution evidence.
- `openapi/`: focused encounter API specification.

## Backend command

The existing Docker backend service is used. The root `testing/` directory is not
mounted inside `/app`, so the host directory is copied to `/tmp/care_testing`
inside the container for execution.

```powershell
docker cp testing care-backend-1:/tmp/care_testing
docker compose -f care/docker-compose.yaml -f care/docker-compose.local.yaml exec backend bash -lc "cd /app && PYTHONPATH=/tmp/care_testing:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.unit care_testing.integration --keepdb --verbosity=2"
```

## Coverage command

```powershell
docker compose -f care/docker-compose.yaml -f care/docker-compose.local.yaml exec backend bash -lc "cd /app && PYTHONPATH=/tmp/care_testing:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/coverage run --rcfile=/tmp/care_testing/coverage/.coveragerc manage.py test care_testing.unit care_testing.integration --keepdb --verbosity=1 && /.venv/bin/coverage report -m && /.venv/bin/coverage json -o /tmp/care_testing/coverage/coverage.json"
```

## Frontend command

Run from `care_fe/`:

```powershell
node --import tsx --test ..\testing\frontend\test_encounter_frontend_rules.ts
```
