# Why the CI SonarQube gate passed while the local gate failed

**Observed on 28 Nov 2026:**
- PR #5's CI run 46144666161 passed the SonarQube quality gate on code that still contained the 5 floating promises (DEF-20).
- The local SonarQube, with the same image digest `sha256:7b2296713a92…` (`sonarqube:community` = local `sonarqube:latest`, 26.11.0.134175), failed the gate on that code.

**Cause.** Rule `typescript:S9383` ("Promises must be awaited…") is **type-aware**. SonarQube's TypeScript analyser needs the project's dependencies (`node_modules`) to resolve types. The CI SonarQube job checked out `care_fe` but never installed its dependencies, so the rule was **silently skipped**.

**Proof** (same code, DEF-20 fix reversed, same server, same gate):

| Scan | `care_fe/node_modules` | Bugs | Reliability rating | Gate |
|---|---|---:|---|---|
| 1 | removed (as in CI) | **0** | A | passes: **blind to the bugs** |
| 2 | present | **5** | C | **fails** (`reliability_rating` 3 > 1) |

**Corrective action** (`.github/workflows/care-quality-gate.yml`): the SonarQube job runs `npm ci --ignore-scripts` in `care_fe` before scanning.

**Expected CI sequence after that change:**
1. Without the DEF-20 fix, the gate **fails**.
2. With the fix applied, the gate **passes**.

**Preventive action.** Treat "analyser ran with full type information" as part of the gate. A green gate isn't evidence of clean code if a rule class didn't run.
