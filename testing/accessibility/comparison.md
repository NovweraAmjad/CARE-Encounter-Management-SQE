# Accessibility before/after comparison

- Before run: 2026-11-27T20:46:58.423Z
- After run: 2026-11-27T20:52:34.341Z
- Fixed screen: **Create Encounter** (see `after/care_fe-create-encounter-fix.patch`)

## Lighthouse scores (0–100)

| Screen | Mode | Category | Before | After | Change |
|---|---|---|---:|---:|---:|
| create | navigation | accessibility | 96 | 96 | 0 |
| create | navigation | best-practices | 100 | 100 | 0 |
| create | navigation | seo | 100 | 100 | 0 |
| create | snapshot | accessibility | 94 | 99 | +5 |
| create | snapshot | best-practices | 100 | 100 | 0 |
| create | snapshot | seo | 100 | 100 | 0 |
| complete | navigation | accessibility | 96 | 96 | 0 |
| complete | navigation | best-practices | 96 | 96 | 0 |
| complete | navigation | seo | 100 | 100 | 0 |

## axe-core violations (rules)

| Screen | Before | After | Rules before | Rules after |
|---|---:|---:|---|---|
| create | 2 | 1 | label, svg-img-alt | svg-img-alt |
| complete | 2 | 2 | aria-command-name, label-content-name-mismatch | aria-command-name, label-content-name-mismatch |

## Unique issues (an issue found by both tools is counted once)

| Screen | Rule | Detected by | axe impact | Before | After | Status |
|---|---|---|---|---|---|---|
| complete | `aria-command-name` | Lighthouse (navigation) + axe-core | serious | present | present | **remaining** |
| complete | `errors-in-console` | Lighthouse (navigation) | — | present | present | **remaining** |
| complete | `label-content-name-mismatch` | Lighthouse (navigation) + axe-core | serious | present | present | **remaining** |
| create | `aria-prohibited-attr` | Lighthouse (navigation) | — | present | present | **remaining** |
| create | `label` | Lighthouse (snapshot) + axe-core | critical | present | absent | **FIXED** |
| create | `svg-img-alt` | Lighthouse (snapshot) + axe-core | serious | present | present | **remaining** |

Unique issues before: 6; after: 5.

Excluded as development-server artifacts (weight 0): `valid-source-maps` — the Vite dev server serves source maps that Lighthouse cannot validate; not present in a production build.
