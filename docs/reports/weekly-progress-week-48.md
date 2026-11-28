# Weekly Progress Report – Week 48 (23–29 Nov 2026)

**Project:** CARE Encounter Management (Create / Complete Patient Encounter)
**Author:** project author (individual project)
**Plan baseline:** `docs/test-plan.md` v1.1

## 1. Progress against the plan

| Phase (test plan §8) | Planned | Status at end of week | Evidence |
|---|---|---|---|
| 1 Planning, requirements, risks | Week 48 | ✅ Done | test plan, risk register (10 product + 2 project risks), estimation |
| 2 Unit tests | Week 48 | ✅ Done | 18 unit tests; 100% statement and branch on the selected business-rule functions |
| 3 API/integration tests | Week 48 | ✅ Done | 46 integration tests + 3 generator tests (67 backend total, all pass) |
| 4 Browser E2E (use cases) | Week 48 | ✅ Done | 2 use cases × (main + 2 alternative + 2 exception) = 10 flows; 30/30 over 3 consecutive runs |
| 5 Generator + OpenAPI | Week 48 | ✅ Done | `testing/openapi/encounter-openapi.yaml`, generator, two-constraint regeneration |
| 6 Mutation + defect analysis | Week 48 | ✅ Done | score 65.1% → **92.8%**; 146 survivors analysed; 20 defects, 3 RCAs |
| 7 CI quality gate | Week 48 | ✅ Done: PR #5 green on GitHub (run 46148402745); blocked demo fails the mutation gate (run 46148457020) | `docs/reports/test-completion-report.md` §6 |
| 8 Regression + final reporting | Week 48 | ✅ Done locally | completion report |
| Section 5 performance + recovery | Week 48 | ✅ Done | k6: p95 ≈ 160 ms (1 VU) / 650–690 ms (5 VUs), 0% failures, all within the pre-set limits; REC-ENC-001 3/3 (`testing/performance/`) |

**Deviations from the plan:**
- **The mutation phase took far longer than estimated.** The harness produced no score at first. After fixing that, it produced *false* verdicts: 0 survivors that were really 146 (four harness defects, see `testing/evidence/mutation-analysis.md` §2).
- **Use-case E2E was under-scoped in Part 1.** There were 2 flows; the brief needs 10. Expanded this week.
- **Actual effort hours** haven't been recorded by the author yet, so the estimation comparison is still open (§5).

## 2. GQM metrics

**Goal.** Judge whether the two encounter workflows are ready for release, from the tester's viewpoint, on the local CARE copy.

| Question | Metric | Value this week | Source |
|---|---|---|---|
| Q1 How defect-prone is the in-scope code? | **Defect density** = product defects located in in-scope modules ÷ KLOC | **9 / 2.096 KLOC = 4.3 defects/KLOC** (DEF-01, 02, 03, 04, 09, 10, 11, 19, 20) | `docs/defects/defect-register.md` |
| Q2 How much of the requirements is verified? | **Requirements coverage** = requirements with ≥1 executed, passing test ÷ all requirements | **10 / 10 = 100%** (9/10 at ≥2 levels) | `docs/traceability-matrix.md` |
| Q3 Do fixes hold? | **Reopen rate** = reopened ÷ closed defects | **0 / 6 = 0%** (closed: DEF-04, 15, 16, 17, 18, 20) | defect register |
| Q4 How effective are the tests? | Mutation score (business-rule module) | **92.8%** (388/418); business-rule functions 100% except 5 equivalent mutants | mutation analysis |
| Q5 Is the business logic fully exercised? | Statement / branch coverage of the selected rule functions | **100% / 100%** (coverage gate passes) | `testing/mutation/coverage_quality_gate.py` |
| Q6 Is the code maintainable and reliable? | SonarQube ratings | Reliability C → A after DEF-20 fix; Security A; Maintainability A | `docs/reports/sonarqube-analysis.md` |

**Trend.** This is the first measured week, so there's no trend yet. The mutation score moved from 65.1% to 92.8% within the week after test improvement.

## 3. Control actions taken this week

| Problem observed | Control action | Result |
|---|---|---|
| Mutation campaign gave no score, then false verdicts | Root-caused 4 harness defects (RCA-3); fixed `campaign.py` and `conftest.py`; re-ran from scratch | Trustworthy baseline (65.1%) |
| 146 surviving mutants | Classified all 146; added 16 targeted tests | 116 killed; 30 left (17 equivalent, 13 DEF-19) |
| Only 2 browser flows | Added 8 alternative/exception flows, each with UI + API post-condition checks | 10/10 flows automated; 30/30 runs |
| CI never passed | Pinned the frontend baseline; seeded fresh-DB fixtures; SonarQube run inside CI with a custom gate; removed `|| true` | Verified locally; awaiting GitHub run |
| SonarQube gate failed (5 bugs, DEF-20) | Fix patch delivered through a pull request | Reliability A after the fix |
| CI frontend job failed only on GitHub (fresh DB, cold Vite server, IPv6 `localhost`) | Reproduced each cause locally under CI conditions, fixed the tests/config | PR #5 run 46144666161 fully green |
| CI SonarQube passed while local failed | Found type-aware rules silently skipped (no `node_modules`); proved by scanning with/without deps | Dependencies installed in CI (`testing/sonar/type-aware-analysis-evidence.md`) |
| PR #4 was merged with a red pipeline | Branch protection not yet enabled on `main` | Repository owner to enable required checks |
| Stale traceability ("Planned") | Rewrote it from executed tests only | 10/10 requirements covered |

## 4. Risks and issues carried forward

| Risk | Status | Action |
|---|---|---|
| PJ-02 schedule (Critical) | Reduced: all phases complete locally | Close once CI passes on GitHub |
| PR-08 authorization (Critical) | Mitigated: 10 role checks + API negatives pass | Keep in CI |
| GitHub-side settings | **Open, needs the author:** branch protection (required checks), opening the PRs, filing the 20 GitHub Issues | Steps in the completion report |

## 5. Estimation status

The three-point estimate (`docs/test-estimation.md`) predicts **82.3 person-hours**. Actual effort per area has to be entered by the author; it isn't derivable from git history. The variance analysis is completed in the estimation document once those figures are supplied.

## 6. Plan for next week

1. Confirm the GitHub Actions run: the fix PR fails before the fix and passes after; the blocked PR is rejected.
2. File the GitHub Issues (`docs/defects/create-issues.ps1`) and record their numbers in the register.
3. Record actual effort and complete the estimation variance.
