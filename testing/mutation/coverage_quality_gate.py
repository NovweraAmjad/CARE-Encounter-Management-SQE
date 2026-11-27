from __future__ import annotations

import json
import sys
from pathlib import Path


SELECTED_FUNCTIONS = {
    "care/emr/api/viewsets/encounter.py": {
        "EncounterViewSet.validate_data",
        "EncounterViewSet.restart",
        "EncounterViewSet.perform_update",
    },
    "care/emr/resources/encounter/spec.py": {
        "EncounterCreateSpec.perform_extra_deserialization",
        "EncounterUpdateSpec.perform_extra_deserialization",
    },
    "care/emr/resources/base.py": {
        "PeriodSpec.validate_period",
    },
}


def main() -> int:
    report = Path(__file__).resolve().parents[1] / "coverage" / "coverage.json"
    if not report.exists():
        print("FAIL: coverage JSON not found")
        return 1
    data = json.loads(report.read_text(encoding="utf-8"))
    failed = []
    for file_name, function_names in SELECTED_FUNCTIONS.items():
        file_info = data.get("files", {}).get(file_name)
        if not file_info:
            failed.append(f"{file_name}: missing coverage file")
            continue
        for function_name in sorted(function_names):
            function_info = file_info.get("functions", {}).get(function_name)
            if not function_info:
                failed.append(f"{function_name}: missing function coverage")
                continue
            summary = function_info["summary"]
            statements = int(summary["num_statements"])
            covered_statements = int(summary["covered_lines"])
            branches = int(summary["num_branches"])
            covered_branches = int(summary["covered_branches"])
            if statements != covered_statements:
                failed.append(f"{function_name}: statements {covered_statements}/{statements}")
            if branches and branches != covered_branches:
                failed.append(
                    f"{function_name}: branches {covered_branches}/{branches}"
                )
    if failed:
        print("FAIL: selected business-rule coverage is incomplete")
        for item in failed:
            print(f"- {item}")
        return 1
    print("PASS: all selected business-rule functions have 100% statement and branch coverage")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
