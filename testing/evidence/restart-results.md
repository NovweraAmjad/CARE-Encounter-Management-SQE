# BR-ENC-06 Restart Test Evidence

## Investigation Result

`test_noncompleted_status_is_rejected` previously returned HTTP 403 because
`can_restart_encounter_obj` performs the status check before
`EncounterViewSet.restart` and rejects non-completed encounters. Routing and the
view are reached, but authorization returns false at that earlier helper. It did
not reach view line 287/288.

The test now patches `AuthorizationController.call` to return true for the isolated
view-level status test. The request then reaches `EncounterViewSet.restart`, rejects
the in-progress status at line 287, and returns HTTP 400.

This patch affects only the independent test call and does not modify production
authorization or application behavior.

## Command

```powershell
docker compose -f .\docker-compose.yaml -f .\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/coverage erase && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/coverage run --rcfile=/tmp/care_testing/coverage/.coveragerc manage.py test care_testing.integration.test_encounter_server_rules.RestartEligibilityIntegrationTests --keepdb --verbosity=2 && /.venv/bin/coverage report -m && /.venv/bin/coverage json -o /tmp/care_testing/coverage/restart-coverage.json'
```

## Exact Results

- `test_every_completed_choice_can_restart_within_limit`: passed
- `test_noncompleted_status_is_rejected`: passed
- `test_restart_age_boundaries`: passed
- `test_unauthorized_user_is_rejected`: passed
- Total: 4 passed, 0 failed, 0 skipped

## Coverage

For `EncounterViewSet.restart`:

- Statements: 12/12 (100%)
- Branches: 6/6 (100%)
- Missing lines: none
- Missing branches: none
- Line 288: covered

The reports are in:

- `testing/coverage/restart-coverage.json`
- `testing/coverage/restart-coverage.xml`
- `testing/coverage/restart-coverage.txt`
