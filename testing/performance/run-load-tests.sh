#!/usr/bin/env bash
# Runs the Section 5 k6 workloads exactly as recorded in results/run-log.txt:
# 1 VU twice, then 5 VUs twice, same build/machine/data, 5 s pause between runs.
# Requires: k6 OSS on PATH, CARE backend on http://127.0.0.1:9000 with fixtures.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p results
date -u +"start %Y-%m-%dT%H:%M:%SZ" | tee results/run-log.txt
for cfg in "1 vu1-run1" "1 vu1-run2" "5 vu5-run1" "5 vu5-run2"; do
  set -- $cfg
  set +e
  k6 run --quiet -e VUS="$1" -e RUN_ID="$2" --out "csv=results/$2-raw.csv.gz" \
    encounter-retrieve.js > "results/$2-console.txt" 2>&1
  code=$?
  set -e
  echo "$2 exit=$code $(date -u +%H:%M:%SZ)" | tee -a results/run-log.txt
  grep -E "^vu[0-9]-run[0-9]: p95" "results/$2-console.txt" | tee -a results/run-log.txt
  sleep 5
done
