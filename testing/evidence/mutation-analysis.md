# CARE Encounter Mutation Analysis

## Verified campaign status

The clean independent Django baseline passed:

- 46 tests found and run.
- Exit code: 0.
- Final Django summary: `Ran 46 tests`, followed by `OK`.

The focused campaign tests passed 12/12.

These baseline results establish that custom test failures can be interpreted
as mutation kills.

## Custom business-rule mutants

The custom campaign artifacts contain three measured, killed mutants:

| Operator | Business rule | Target | Verdict | Evidence |
|---|---|---|---|---|
| `BR01_ACTIVE_LIMIT_COMPARISON` | BR-ENC-01 | `care/emr/api/viewsets/encounter.py` | Killed | 46 tests ran; 18 failures and 3 errors; return code 1 |
| `BR06_RESTART_ELAPSED_TIME` | BR-ENC-06 | `care/emr/api/viewsets/encounter.py` | Killed | 46 tests ran; 8 failures; return code 1 |
| `BR03_STATUS_HISTORY_CHANGE` | BR-ENC-03 | `care/emr/resources/encounter/spec.py` | Killed | 46 tests ran; 4 failures; return code 1 |

Supporting artifacts:

- [`custom-mutant-results.json`](../mutation/results/custom-mutant-results.json)
- [`custom-mutants-manifest.json`](../mutation/results/custom-mutants-manifest.json)
- [`mutation-summary.json`](../mutation/results/mutation-summary.json)

Custom totals:

- Generated: 3
- Killed: 3
- Survived: 0
- Blocked: 0
- Detection rate: 100%

The three killed custom mutants are not counted as surviving mutants.

## Standard mutmut status

Standard mutmut statistics collection remains blocked:

- `mutation-results.json` records return code 1 and
  `failed to collect stats. runner returned 1`.
- `mutation-summary.json` reports `standard_mutation_score: null`.
- No standard mutation score is claimed.

This prevents tool-confirmed standard survivor records and prevents a standard
score from being calculated.

## Survivor register

The structured register is
[`survivor-analysis.json`](../mutation/results/survivor-analysis.json).

Status totals in that register:

- Confirmed tool survivors: 0
- Manually analysed mutation candidates: 18
- Potentially equivalent candidates: 0
- Killed after test improvements: 0
- Candidates not executed: 18

The requirement to analyse at least 15 tool-confirmed surviving mutants is not
fulfilled because no tool-confirmed survivors exist in the current artifacts.
The 18 entries below are manual, source-based mutation candidates, not
confirmed survivors.

| Candidate | Mutant ID | Business rule | Original -> mutation | Classification | Verification |
|---|---|---|---|---|---|
| MCA-ENC-001 | None | BR-ENC-01 | `>= limit` -> `> limit` | Weak assertion | Not executed |
| MCA-ENC-002 | None | BR-ENC-01 | `>= limit` -> `<= limit` | Missing test | Not executed |
| MCA-ENC-003 | None | BR-ENC-01 | Exclude completed statuses -> exclude active-only set | Missing test | Not executed |
| MCA-ENC-004 | None | BR-ENC-01 | `model_obj is None` -> `is not None` | Missing test | Not executed |
| MCA-ENC-005 | None | BR-ENC-01 | Patient exists check -> negated check | Weak assertion | Not executed |
| MCA-ENC-006 | None | BR-ENC-01 | Facility exists check -> negated check | Weak assertion | Not executed |
| MCA-ENC-007 | None | BR-ENC-03 | `old != new` -> `old == new` | Missing test | Not executed |
| MCA-ENC-008 | None | BR-ENC-03 | Append one history entry -> append twice | Weak assertion | Not executed |
| MCA-ENC-009 | None | BR-ENC-03 | Correct status/timestamp fields -> wrong fields | Missing test | Not executed |
| MCA-ENC-010 | None | BR-ENC-03 | Clear advice only on update -> clear without update guard | Missing test | Not executed |
| MCA-ENC-011 | None | BR-ENC-06 | `status not in completed` -> `in completed` | Missing test | Not executed |
| MCA-ENC-012 | None | BR-ENC-06 | `< cutoff` -> `<= cutoff` | Weak assertion | Not executed |
| MCA-ENC-013 | None | BR-ENC-06 | `< cutoff` -> `> cutoff` | Missing test | Not executed |
| MCA-ENC-014 | None | BR-ENC-06 | Set in-progress -> set completed | Missing test | Not executed |
| MCA-ENC-015 | None | BR-ENC-06 | Save status/audit fields -> save status only | Missing test | Not executed |
| MCA-ENC-016 | None | Period | `start > end` -> `start >= end` | Weak assertion | Not executed |
| MCA-ENC-017 | None | Period | `start > end` -> `start < end` | Missing test | Not executed |
| MCA-ENC-018 | None | Period timezone | Naive start check -> removed/negated | Missing test | Not executed |

## Test improvements added

Two focused unit tests were added to
[`test_encounter_server_rules.py`](../unit/test_encounter_server_rules.py):

- `test_changed_status_history_entry_has_no_extra_entries`
  - Verifies exact history length and preservation of the old entry.
- `test_equal_start_and_end_are_accepted`
  - Verifies equal period endpoints remain valid.

These tests improve candidate coverage but do not constitute a confirmed
survivor retest because no mutation IDs or tool execution are present.

The updated independent unit and integration suite was run in the CARE Docker
backend and passed: 48 tests run, 48 tests passed, exit code 0.

## Classification categories

- **Tool-confirmed surviving mutant:** A mutant that the campaign records as
  survived and for which the mutant ID, source location and output exist.
- **Manually analysed candidate:** A source-based candidate without tool
  execution evidence.
- **Potentially equivalent:** A candidate that preserves observable behavior
  under the inspected rule; no equivalence is claimed without evidence.
- **Killed after test improvement:** No candidate currently has this status.
- **Candidate not executed:** The mutation has not been run individually or by
  an actual standard campaign.

No candidate is classified as equivalent, and no candidate is recorded as
killed after a test improvement.

## Remaining assignment gaps

1. No tool-confirmed surviving mutant records exist.
2. Standard mutmut statistics collection remains unavailable.
3. The required 15-survivor analysis is not fulfilled.
4. The 18 manual candidates have not been executed and must not be counted as
   survivors.
5. Exact mutant IDs, original expressions and mutated expressions are available
   only after a completed standard mutmut run.
