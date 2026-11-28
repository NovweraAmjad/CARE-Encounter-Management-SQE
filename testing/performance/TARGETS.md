# Section 5 – Performance Targets (set BEFORE any load test was run)

**Recorded:** 28 Nov 2026, before the first k6 run. The run outputs in `results/` carry later timestamps.

## Operation under test

`GET /api/v1/encounter/{id}/`: retrieve one encounter, authenticated as the synthetic `care-doctor` account.

**Why this operation:**
- **Both workflows depend on it.** Create Encounter redirects to the new encounter's page, which loads it. The Complete Encounter screen loads it before and after "Mark as Completed".
- Every page view of the encounter screen pays this cost, so its latency is directly felt by clinicians.
- It's **read-only**, so thousands of repetitions don't change the starting data. Every run starts from the same data, as the brief requires.
- It exercises the full request path: JWT authentication, the role/authorization check (`authorize_retrieve`), database queries, and serialization of the patient, organizations, location history and care team.

## Limits

| Workload | p95 response-time limit | Unexpected-failure limit |
|---|---|---|
| 1 simulated user (VU) | **p95 ≤ 500 ms** | **< 1%** of requests |
| 5 simulated users at the same time | **p95 ≤ 1,000 ms** | **< 1%** of requests |

An *unexpected failure* is any response other than **HTTP 200**: errors, timeouts, 4xx or 5xx. Every request in the script is valid and authorized, so no failure is expected.

## Why these limits suit this operation

**p95 ≤ 500 ms (1 user).**
- Opening an encounter is an interactive step in a clinical workflow.
- Delays under about half a second feel immediate, and the page also needs time to render after the API returns.
- One user is the uncontended case, so this is the baseline the system must meet with no competition for resources.
- p95 rather than the mean, so occasional slow requests (cache misses, garbage collection) aren't hidden by averages.

**p95 ≤ 1,000 ms (5 concurrent users).**
- Five clinicians opening encounters at once on the same small deployment is realistic for one ward.
- Requests then queue for the same CPU and database, so some slowdown is expected and acceptable.
- One second is the commonly used limit for keeping a user's flow of thought uninterrupted. Above it, staff perceive the system as slow, during patient care.
- The target is relaxed by 2×, not 5×, because a healthy system shouldn't degrade linearly with only 5 users.

**Failures < 1% (both workloads).**
- Retrieving an existing encounter has no legitimate failure mode for an authorized user.
- A failed load means a clinician sees an error instead of the patient's encounter.
- Fewer than 1 in 100 allows a rare transient blip (a restart or connection reset) but fails a systematic problem: locking, connection exhaustion, or errors under concurrency.

## Measurement rules

- Each workload runs **twice**, with the same build, machine and starting data.
- Each run: a **10 s ramp-up**, then **60 s at the target number of users**. **Only the 60 s steady phase is measured** (requests tagged `phase:steady`).
- **No think time.** Each simulated user sends its next request as soon as the previous one returns. That's a stress measure of capacity. Real users pause between requests, so real load per user is lower.
- Measures per run: p95 (ms), completed requests per second (steady-phase requests ÷ 60 s), and the percentage of unexpected failures.
