# Mutation Testing - CARE Encounter Management

This workflow is independent of `care/` and `care_fe/`. Campaign runs copy both
the upstream source and `testing/` into temporary directories and never mutate
the host upstream checkout.

## 1. Start the existing Docker environment

From the project root:

```powershell
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml up -d
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml ps
```

The `care-backend-1` and `care-db-1` services must be running and healthy.

## 2. Copy the independent testing package into the backend

```powershell
docker cp .\testing\. care-backend-1:/tmp/care_testing/
```

The destination must contain `/tmp/care_testing/mutation/campaign.py`,
`/tmp/care_testing/unit/`, `/tmp/care_testing/integration/`, and
`/tmp/care_testing/conftest.py`.

## 3. Run focused campaign unit tests

From the host project root:

```powershell
python -m unittest testing.mutation.test_campaign -v
```

Expect 12 focused tests to pass unless you are using a Python environment that
does not have the project dependencies. The campaign tests do not mutate source
or require Docker.

## 4. Verify the clean Django baseline

```powershell
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp/care_testing:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.unit care_testing.integration --keepdb --verbosity=1'
```

Only treat mutation failures as kills after this command ends with `Ran 46 tests`
and `OK`, with exit code 0.

## 5. Run the complete campaign

```powershell
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'mkdir -p /tmp/care_mutation_workspace/results && cd /tmp/care_mutation_workspace && PYTHONPATH=/tmp:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python /tmp/care_testing/mutation/campaign.py --source-root /app --testing-root /tmp/care_testing --mutmut-bin /.venv/bin/mutmut --python-bin /.venv/bin/python --results-dir /tmp/care_mutation_workspace/results'
```

The wrapper:

1. Creates temporary source and testing copies.
2. Verifies the clean Django baseline.
3. Executes all three custom business-rule operators.
4. Restores each custom target source file with `finally`.
5. Runs mutmut, exports statistics, and parses actual survivor output.
6. Writes JSON and prints the campaign summary.

## 6. Export final results to the project

```powershell
docker cp care-backend-1:/tmp/care_mutation_workspace/results/. .\testing\mutation\results\
```

This copies final Docker artifacts into the local project. Required artifacts
are:

- `testing/mutation/results/mutation-results.json`
- `testing/mutation/results/mutmut-standard-run.json`
- `testing/mutation/results/custom-mutant-results.json`
- `testing/mutation/results/custom-mutants-manifest.json`
- `testing/mutation/results/mutation-summary.json`
- `testing/mutation/results/surviving-mutants.json` only if actual standard
  mutants survived

`mutmut-cicd-stats.json` and `mutmut-config-discovery.json` are preserved as
supporting evidence when produced.

## 7. Validate JSON and status

Run this from the project root:

```powershell
python -c "import glob,json; files=glob.glob(r'testing/mutation/results/*.json'); [json.load(open(p,encoding='utf-8')) for p in files]; print('Valid JSON:', len(files))"
```

Then inspect:

```powershell
Get-Content .\testing\mutation\results\mutation-summary.json
Get-Content .\testing\mutation\results\custom-mutant-results.json
Get-Content .\testing\mutation\results\mutation-results.json
```

The summary distinguishes standard mutmut results from custom operator results.
It reports a standard mutation score only if the standard run and statistics
export are successful.

## 8. Validate the manual survivor register

After updating test improvements or campaign artifacts, validate the machine
readable register and evidence status:

```powershell
python -c "import json; p=r'testing/mutation/results/survivor-analysis.json'; d=json.load(open(p,encoding='utf-8')); print(d['confirmed_survivor_count'], d['manually_analysed_candidate_count'], d['candidates_not_executed_count'])"
```

Expected values before a completed standard mutmut run: 0 confirmed survivors,
18 manually analysed candidates and 18 candidates not executed. A completed
mutmut campaign must replace `mutant_id: null` entries with actual IDs only
after its artifacts are inspected.

To rerun the independent suite after test improvements:

```powershell
docker cp .\testing\. care-backend-1:/tmp/care_testing/
docker compose -f .\care\docker-compose.yaml -f .\care\docker-compose.local.yaml exec backend bash -lc 'cd /app && PYTHONPATH=/tmp/care_testing:/app DJANGO_SETTINGS_MODULE=config.settings.test /.venv/bin/python manage.py test care_testing.unit care_testing.integration --keepdb --verbosity=1'
```
