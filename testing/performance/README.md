# Section 5 – Performance and Recovery

| File | Content |
|---|---|
| [`TARGETS.md`](TARGETS.md) | Operation, limits and their justification, **set before testing** |
| `encounter-retrieve.js` | k6 OSS workload script (one script, parameterised by `VUS`) |
| `run-load-tests.sh` | Runs the 4 measured runs |
| `results/` | Raw output for every run (see below) |
| `../integration/test_failure_recovery.py` | Automated failure-and-recovery test (`REC-ENC-001`), Django test runner |

Raw output for each run `vuN-runM`:
- `-console.txt`: k6 stdout
- `-raw.csv.gz`: every request sample
- `-k6-summary-full.json`: k6's complete summary
- `-summary.json`: the measured numbers
- Also `run-log.txt` and `recovery-test-runs.log`.

## 1. Environment

All runs used the same build, machine and starting data, back to back on 28 Nov 2026, 11:24–11:30 UTC.

| Item | Value |
|---|---|
| Machine | 13th Gen Intel Core i5-13450HX (10 cores / 16 threads), 23.7 GB RAM |
| OS | Windows 11 Pro 10.0.26300; Docker Desktop 29.7.2 (VM: 16 CPUs, 11.5 GB) |
| Load generator | **k6 OSS v2.2.0** (native Windows binary, same machine as the server) |
| Backend build | CARE `ddfd840` (baseline), Python 3.13.18, Django 6.0 |
| Server process | `scripts/start-dev.sh` → `manage.py runserver_plus 0.0.0.0:9000 --print-sql` (CARE's local development server, in Docker) |
| Database | PostgreSQL 17.12 (Docker `care-db-1`); Redis (Docker `care-redis-1`) |
| Starting data | Synthetic fixtures + earlier test data: **410 encounters, 11 patients**. The workload is read-only, so every run starts from this same data. |
| Account | `care-doctor` (synthetic fixture user) |

## 2. Load test results (k6, `GET /api/v1/encounter/{id}/`)

Measured window: **60 s after the workload reached the target number of users** (requests tagged `phase:steady`).

| Run | Users | Requests (60 s) | **p95 (ms)** | Median (ms) | Max (ms) | **Requests/s** | **Unexpected failures** | p95 limit | Failure limit | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| vu1-run1 | 1 | 440 | **158.7** | 132.2 | 339.9 | **7.3** | **0.00%** | ≤ 500 | < 1% | ✅ Pass |
| vu1-run2 | 1 | 433 | **161.3** | 134.6 | 308.9 | **7.2** | **0.00%** | ≤ 500 | < 1% | ✅ Pass |
| vu5-run1 | 5 | 573 | **690.5** | 511.9 | 866.7 | **9.6** | **0.00%** | ≤ 1,000 | < 1% | ✅ Pass |
| vu5-run2 | 5 | 583 | **649.6** | 500.1 | 786.6 | **9.7** | **0.00%** | ≤ 1,000 | < 1% | ✅ Pass |

Every k6 threshold passed (exit code 0). Both checks (`status is 200`, `returns the requested encounter`) held for 100% of requests.

### Interpretation against the targets

**1 user: well within target.**
- p95 of about 160 ms is **less than a third of the 500 ms limit**, with no failures.
- The two runs agree within 2.6 ms (p95) and 0.1 req/s, so the measurement is stable.

**5 users: within target, but with limited headroom and a clear bottleneck.**
- p95 of 650–690 ms is **inside the 1,000 ms limit**, with zero failures, so the targets are met.
- But throughput rose only **from about 7.2 to about 9.65 req/s (+34%) for 5× the users**, while the median rose **about 3.8×** (133 → 506 ms).
- **Little's law confirms the requests are queuing:** in-flight requests = throughput × response time = 9.65 req/s × 0.506 s ≈ **4.9, the 5 users**. The server completes roughly one request every ~104 ms whatever the number of users, so extra users wait instead of being served in parallel.
- **Cause (from the configuration, not measured further):** the backend runs CARE's **development** server, `runserver_plus --print-sql`. That's one Python process, which also writes every SQL query to the console. It isn't the production gunicorn setup (`scripts/start.sh` uses multiple workers).
- **Projection, not a measurement:** with this per-request cost, about 10 concurrent users would push p95 past 1 s. These results are therefore a lower bound for a production deployment, and the 5-user target should be re-checked against gunicorn before any capacity claim is made.

**Reliability under load.** 0 unexpected failures in 2,029 measured requests. Concurrency introduced no errors, locking problems or authentication failures.

**Caveats:**
- k6 ran on the same machine as the server, so the load generator and the server share CPU.
- There's no think time, so load per user is higher than with real clinicians.
- These make the numbers conservative.

## 3. Failure-and-recovery test (`REC-ENC-001`)

**Operation:** `POST /api/v1/encounter/`, a state-changing operation that creates an encounter linked to an appointment booking.

**Dependency failure:** Redis, behind CARE's `FacilityEncounterCreateLock`, becomes unavailable **during the write**.
- In `EncounterViewSet.perform_create`, the lock is acquired after the `Encounter` row, its `EncounterOrganization` link and the booking association are written.
- That's before the transaction commits and before the patient's facility identifier is created.
- A test double (`patch.object(FacilityEncounterCreateLock, "acquire", side_effect=redis.ConnectionError)`) makes it fail at exactly that point.

| Step | Assertion | Result |
|---|---|---|
| Before | 0 encounters, 0 organization links, booking free, 0 identifiers | ✅ |
| Fail | Lock called once (failure happened mid-write); response **HTTP 500** | ✅ |
| Persisted state after the failure | **Unchanged**: no encounter, no organization link, booking still free, no identifier (the atomic transaction rolled back) | ✅ |
| Restore + retry the identical request | HTTP 200 | ✅ |
| Final state | **Exactly 1** encounter (in progress, 1 history entry), **1** organization link, booking linked to **that** encounter, **1** identifier | ✅ |
| Duplicate retry (client re-sends) | HTTP 400 ("booking already associated"); state still exactly 1 of each, **no duplicate** | ✅ |

**Runs:** 3/3 passed (`results/recovery-test-runs.log`). The `ERROR … Redis unavailable (simulated)` lines in the log are the server logging the injected failure.

The test sits in `testing/integration/`, so it also runs in CI with every pull request.

**Interpretation.** Encounter creation is **safe to retry** after a Redis outage:
- The partial write is rolled back completely.
- The retry creates exactly one record.
- The booking link prevents a second encounter for the same appointment.

One weakness: the client gets a generic **500** rather than a retry-able 503 or 400 with a message. That's because only `ObjectLocked` is translated into a user-facing error, not connection failures. It's worth reporting upstream alongside DEF-01/02 (database errors also surface as 500).
