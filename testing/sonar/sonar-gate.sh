#!/usr/bin/env bash
# Initialise a FRESH SonarQube, create the project's quality gate from
# testing/sonar/quality-gate.json, run the scan and fail if the gate fails.
#
# Used by CI (SonarQube runs as a job service on :9000) and locally against a
# separate fresh container. Requires: curl, node, and either sonar-scanner on
# PATH or npx (for @sonar/scan).
#
#   SONAR_HOST_URL        default http://localhost:9000
#   SONAR_ADMIN_PASSWORD  on a brand-new server: the password to set (random if
#                         unset); on an already-initialised server: its admin
#                         password (required, used to manage the gate)
set -euo pipefail

HOST="${SONAR_HOST_URL:-http://localhost:9000}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GATE_FILE="$ROOT/testing/sonar/quality-gate.json"
OUT="$ROOT/testing/sonar/results"
mkdir -p "$OUT"

echo "Waiting for SonarQube at $HOST"
for _ in $(seq 1 120); do
  if curl -fs "$HOST/api/system/status" | grep -q '"status":"UP"'; then break; fi
  sleep 5
done
curl -fs "$HOST/api/system/status" | grep -q '"status":"UP"'

if curl -fs -u admin:admin "$HOST/api/authentication/validate" | grep -q '"valid":true'; then
  # Brand-new server: first-run password is admin/admin; replace it.
  PW="${SONAR_ADMIN_PASSWORD:-Sqe-$(node -e 'process.stdout.write(require("crypto").randomBytes(12).toString("hex"))')Aa1!}"
  curl -fs -u admin:admin -X POST "$HOST/api/users/change_password" \
    --data-urlencode login=admin --data-urlencode previousPassword=admin --data-urlencode "password=$PW" >/dev/null
else
  PW="${SONAR_ADMIN_PASSWORD:?server is already initialised: set SONAR_ADMIN_PASSWORD}"
fi
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$PW"
AUTH=(-u "admin:$PW")
SONAR_TOKEN="$(curl -fs "${AUTH[@]}" -X POST "$HOST/api/user_tokens/generate" \
  --data-urlencode "name=sqe-$(date +%s)" --data-urlencode type=GLOBAL_ANALYSIS_TOKEN \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).token))')"
[ -n "${GITHUB_ACTIONS:-}" ] && echo "::add-mask::$SONAR_TOKEN"

# Quality gate from the versioned JSON (name + conditions on overall code).
GATE_NAME="$(node -e 'process.stdout.write(require(process.argv[1]).name)' "$GATE_FILE")"
if curl -fs "${AUTH[@]}" "$HOST/api/qualitygates/show" --get --data-urlencode "name=$GATE_NAME" >/dev/null 2>&1; then
  echo "Quality gate '$GATE_NAME' already exists on this server"
else
  curl -fs "${AUTH[@]}" -X POST "$HOST/api/qualitygates/create" --data-urlencode "name=$GATE_NAME" >/dev/null
  node -e '
    const g = require(process.argv[1]);
    for (const c of g.conditions) console.log([c.metric, c.op, c.error].join(" "));
  ' "$GATE_FILE" | while read -r metric op error; do
    curl -fs "${AUTH[@]}" -X POST "$HOST/api/qualitygates/create_condition" \
      --data-urlencode "gateName=$GATE_NAME" --data-urlencode "metric=$metric" \
      --data-urlencode "op=$op" --data-urlencode "error=$error" >/dev/null
  done
fi
curl -fs "${AUTH[@]}" -X POST "$HOST/api/qualitygates/set_as_default" --data-urlencode "name=$GATE_NAME" >/dev/null

python "$ROOT/testing/coverage/sonar_coverage_paths.py"

SCAN_ARGS=(-Dsonar.host.url="$HOST" -Dsonar.token="$SONAR_TOKEN" -Dsonar.qualitygate.wait=true -Dsonar.qualitygate.timeout=600)
cd "$ROOT"
set +e
if command -v sonar-scanner >/dev/null; then
  sonar-scanner "${SCAN_ARGS[@]}"
else
  npx --yes @sonar/scan@4.4.0 "${SCAN_ARGS[@]}"
fi
SCAN_EXIT=$?
set -e

# Export the measures and gate status as evidence (also when the gate fails).
KEY=care-encounter-management
METRICS=ncloc,functions,complexity,cognitive_complexity,duplicated_lines_density,duplicated_blocks,code_smells,bugs,vulnerabilities,security_hotspots,coverage,line_coverage,branch_coverage,sqale_index,sqale_debt_ratio,sqale_rating,reliability_rating,security_rating,security_review_rating
curl -fs "${AUTH[@]}" "$HOST/api/measures/component?component=$KEY&metricKeys=$METRICS" > "$OUT/measures.json"
curl -fs "${AUTH[@]}" "$HOST/api/measures/component_tree?component=$KEY&qualifiers=FIL&metricKeys=ncloc,complexity,cognitive_complexity,coverage,code_smells,bugs,vulnerabilities,duplicated_lines_density,sqale_index&ps=100" > "$OUT/measures-by-file.json"
curl -fs "${AUTH[@]}" "$HOST/api/qualitygates/project_status?projectKey=$KEY" > "$OUT/quality-gate-status.json"
curl -fs "${AUTH[@]}" "$HOST/api/issues/search?componentKeys=$KEY&ps=500&issueStatuses=OPEN,CONFIRMED" > "$OUT/issues.json"
node -e '
  const s = require(process.argv[1]).projectStatus;
  console.log("Quality gate:", s.status);
  for (const c of s.conditions) console.log(`  ${c.status.padEnd(5)} ${c.metricKey} actual=${c.actualValue} ${c.comparator} ${c.errorThreshold}`);
' "$OUT/quality-gate-status.json"
exit $SCAN_EXIT
