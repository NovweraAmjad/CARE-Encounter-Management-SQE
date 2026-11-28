# Mutation Testing Analysis – CARE Encounter Business-Rule Module

**Tool.** mutmut 3.8.1 (pytest 9.2.0) inside the CARE backend container (Python 3.13.18, Django 6.0).

**Module under mutation.** The business-rule module for both workflows:
- `care/emr/api/viewsets/encounter.py`: `EncounterViewSet` (`validate_data` BR-ENC-01, `perform_create`, `perform_update` BR-ENC-05, authorization) and the list filters
- `care/emr/resources/encounter/spec.py`: create/update specs (BR-ENC-03 status history) and serializers

**Tests used.** 18 unit + 46 integration tests (`testing/unit`, `testing/integration`).

**Evidence.** Everything is in `testing/mutation/results/`:

| File | Content |
|---|---|
| `baseline-before-test-improvement/mutmut-cicd-stats.json`, `mutmut-results-all.txt` | Baseline run (all 418 mutants) |
| `after-test-improvement/mutmut-cicd-stats.json`, `mutmut-results-all.txt`, `setup.cfg` | Run after the new tests |
| `after-test-improvement/baseline-survivor-diffs.tsv` | `mutmut show` diff for each baseline survivor, plus its status afterwards |
| `survivor-analysis.json` / `.md` | The classified register, built by `build_survivor_analysis.py` |
| `mutation-summary.json`, `mutmut-cicd-stats.json`, `custom-mutant-results.json`, `custom-mutants/` | Output of the end-to-end `campaign.py` run (same command CI uses) |

`build_survivor_analysis.py` **fails** if any classification contradicts the measured results: a "killable" mutant that wasn't killed, or an "equivalent" one that was. The register therefore can't drift from the data.

## 1. Mutation score

| Run | Total | Killed | Survived | Timeout | No tests | Score = killed / total |
|---|---:|---:|---:|---:|---:|---:|
| Baseline (before test improvement) | 418 | 272 | 146 | 0 | 0 | **65.1%** |
| After test improvement | 418 | 388 | 30 | 0 | 0 | **92.8%** |
| After, excluding the 17 proven-equivalent mutants | 401 | 388 | 13 | 0 | 0 | **96.8%** |

**Business-rule functions after improvement:**

| Function | Score | Detail |
|---|---:|---|
| `validate_data` (BR-ENC-01) | 100% | 21/21 |
| create/update `perform_extra_deserialization` (BR-ENC-03) | 100% | 54/54 |
| `perform_update` (BR-ENC-05) | 100% | |
| `authorize_create` / `authorize_update` | 100% | |
| `perform_create` | 89.8% | 44/49; all 5 survivors proven equivalent |

**CI gate.** `testing/mutation/quality_gate.py` fails below **80%** killed ÷ (killed + survived).

Why 80%:
- 13 of the remaining survivors can't be killed without asserting a known defect (DEF-19).
- 17 are equivalent, so the attainable maximum is 96.8%.
- 80% leaves about 13 points of margin. That margin absorbs normal additions of untested non-rule code, but a regression that removes a group of assertions fails the build. For example, deleting `API-ENC-041` alone would leave 40+ serializer mutants alive.

## 2. Why earlier runs reported different numbers (harness defects found and fixed)

The first recorded campaign never produced a score (DEF-16; RCA-3 in `docs/defects/rca.md`). Fixing that exposed **three further harness defects**. Each one changed the verdicts, so no number from before the fix is used.

| # | Symptom | Root cause (reproduced) | Fix |
|---|---|---|---|
| H1 | `failed to collect stats. runner returned 1` | mutmut runs pytest in `mutants/`, which lacked Django's `config` package | `also_copy` in the generated `setup.cfg` |
| H2 | `file or directory not found: test_…::…` per mutant | Tests lived outside the project root, so mutmut's test ids didn't resolve | Tests copied inside the project copy; relative selection |
| H3 | "Failed to run clean test" (FK violation on `emr_patientidentifier`) | `pytest.main()` runs twice in one process; the conftest rebuilt the test DB on the 2nd call | Test DB created once per process tree (`testing/conftest.py`) |
| H4 | **False kills and false timeouts.** A first "full" run showed 292 killed, 25 timeouts and **0 survivors** | Each forked mutant worker rebuilt the test DB (SIGXCPU, exit −24). With 2 workers, both also used one test DB and CARE's Redis create-lock at once. **Verified:** `authorize_retrieve` mutants 10 and 19 showed "killed" but pass their 3 mapped tests when run alone | Fork-safe DB reuse; `--max-children 1` in `campaign.py` |

After H4, the same 418 mutants gave **272 killed / 146 survived** with 0 timeouts: the trustworthy baseline. The earlier "0 survivors" result was an artefact of broken isolation, not of strong tests.

## 3. Survivor analysis (146 analysed)

| Classification | Count | Meaning | After improvement |
|---|---:|---|---|
| Missing test | 88 | No test exercised the behaviour | **All killed** |
| Weak assertion | 28 | Tests ran the code but didn't assert the changed detail (usually an exact error message or a timestamp) | **All killed** |
| Equivalent | 17 | No observable difference (reasons below) | Survive |
| Not killed: defect | 13 | Killing them means asserting the `live` filter's semantics, which are inverted (DEF-19) | Survive |

The full per-mutant table, with diff, class, killing test and after-status, is in `testing/mutation/results/survivor-analysis.md`.

### 3.1 Equivalent mutants (17)

| Mutants | Change | Why equivalent |
|---|---|---|
| `authorize_retrieve` 10, 19 | `return True` → `return False` | The caller ignores the return value; only raising denies access. **Verified** by running the 3 retrieve tests against each mutant: they pass. |
| `get_queryset` 9–14 | one `select_related(...)` argument removed | Affects query count only, not results |
| `perform_create` 4, 7 | `getattr` default changed / removed | The create spec always sets `_organizations` |
| `perform_create` 21 | `if not organizations` inverted | The cache is also synced elsewhere. **Verified:** `API-ENC-042` passes against the mutant. |
| `perform_create` 28, 46 | `update_fields` removed | Saving all fields writes identical values |
| List-spec 17, 18; retrieve-spec 38, 39 | key of a `None` value renamed | The field's default is already `None` |

### 3.2 Not killed: defect DEF-19 (13)

`LiveFilter.filter` mutants 2–14. `live=true` returns **completed** encounters, while the frontend uses it for the "Live" view (`EncounterList.tsx:129`). A killing test would either fail (if it asserted the intended semantics) or lock in the defect (if it asserted the current ones), as the upstream test `test_filters_by_live_as_true` does. They're left alive deliberately and reported as DEF-19.

### 3.3 Representative killable survivors and the tests that killed them

| Mutant(s) | Change | Class | Killed by |
|---|---|---|---|
| `validate_data` 5 | active count no longer filtered by **patient** | missing test | API-ENC-033: another patient at the limit must not block |
| `validate_data` 13, 19 | message `"XXPatient does not existXX"` | weak assertion | UNIT tests now compare the **exact** message; `assertRaisesMessage` only checked a substring |
| `authorize_create` 1, 9 | permission checked with **no facility** | missing test (security) | API-ENC-036: a role in facility A can't create in facility B |
| `authorize_update` 10–13 / `authorize_create` 15–18 | 403 message changed | weak assertion | API-ENC-036/037: exact `detail` |
| Create-spec 25 | booking looked up **without its id** | missing test | API-ENC-039: two bookings; the requested one is linked |
| `perform_create` 26–34 | booking association / `updated_by` not saved | missing test | API-ENC-039: booking read back after create |
| `perform_create` 37–40 | lock-failure message | weak assertion | API-ENC-040: lock patched to raise `ObjectLocked` |
| `perform_create` 41, 42, 45 | default identifiers evaluated for `None` | missing test | API-ENC-034: facility identifier `100` created and shown |
| Create-spec 40, update-spec 11 | `moved_at` = `"None"` | weak assertion | API-ENC-034/035: `moved_at` is a current timestamp |
| Update-spec 12 | `and` → `or`: **advice wiped on every update** | missing test | API-ENC-035: advice read back after update |
| `get_queryset` 31–58, 73, 87–92 | `?patient=` path, facility lookup, no-filter 403 | missing test / weak assertion | API-ENC-038 |
| Retrieve-spec 4–63 (44 mutants) | detail payload fields dropped or renamed | missing test | API-ENC-041: every field read back for a full and a bare encounter |

An earlier pass (the first, broken-harness campaign) had flagged `authorize_retrieve` and the list serializer and filters as having **no tests at all**. API-ENC-027 to 032 were written then and are already part of the 272-killed baseline.

## 4. Custom business-rule mutation operators

mutmut 3 doesn't mutate decorated functions (`@action restart`, `@model_validator validate_period`), and it never produces rule-specific boundary changes. So `testing/mutation/custom_operators.py` defines three operators that `campaign.py` applies to the real source and runs against the full Django suite:

| Operator | Rule | Mutation | Expected |
|---|---|---|---|
| `BR01_ACTIVE_LIMIT_COMPARISON` | BR-ENC-01 | `...count() >= MAX` → `...count() <= MAX` (the limit check is inverted) | Killed by the 0/4/5/6 boundary tests |
| `BR06_RESTART_ELAPSED_TIME` | BR-ENC-06 | the comparison on `modified_date` (restart window) is forced to `>` | Killed by the restart age boundaries |
| `BR03_STATUS_HISTORY_CHANGE` | BR-ENC-03 | first `!=` → `==` (`old_instance.status != self.status`, the "append history on status change" check) | Killed by changed/unchanged-status tests |

The results of the end-to-end campaign run are in `custom-mutant-results.json` and summarised in section 5.

## 5. End-to-end campaign run (same command as CI)

See `testing/mutation/results/mutation-summary.json`, written by `campaign.py`.
