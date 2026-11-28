from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from custom_operators import apply_operator, operator_catalog


TARGETS = (
    "care/emr/api/viewsets/encounter.py",
    "care/emr/resources/encounter/spec.py",
)


def write_mutation_results(results_dir: Path, data: dict) -> None:
    (results_dir / "mutation-results.json").write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )


def clean_suite_discovery(run) -> dict:
    combined = f"{run.stdout}\n{run.stderr}".lower()
    discovered = (
        "found " in combined
        and ("test(s)" in combined or "tests" in combined)
        and "0 test" not in combined
        and "found 0 test" not in combined
    )
    completed = (
        "ran " in combined
        and "ok" in combined
        and run.returncode == 0
    )
    return {
        "discovered": discovered,
        "completed": completed,
        "returncode": run.returncode,
        "stdout": run.stdout,
        "stderr": run.stderr,
    }


def classify_custom_run(run) -> str:
    combined = f"{run.stdout}\n{run.stderr}"

    ran_matches = re.findall(
        r"(?im)^\s*Ran\s+(\d+)\s+tests?\b.*$",
        combined,
    )
    ran_count = int(ran_matches[-1]) if ran_matches else 0
    if ran_count < 1:
        return "blocked"

    failed_matches = list(
        re.finditer(
            r"(?im)^\s*FAILED\s*\(([^)\r\n]*)\)\s*$",
            combined,
        )
    )
    ok_matches = list(
        re.finditer(
            r"(?im)^\s*OK(?:\s*\([^)\r\n]*\))?\s*$",
            combined,
        )
    )
    summaries = [
        (match.start(), "failed", match)
        for match in failed_matches
    ] + [
        (match.start(), "ok", match)
        for match in ok_matches
    ]
    if not summaries:
        return "blocked"

    _, final_status, final_match = max(summaries, key=lambda item: item[0])
    if final_status == "failed":
        failures_match = re.search(
            r"\bfailures=(\d+)\b",
            final_match.group(1),
            re.IGNORECASE,
        )
        errors_match = re.search(
            r"\berrors=(\d+)\b",
            final_match.group(1),
            re.IGNORECASE,
        )
        failures = int(failures_match.group(1)) if failures_match else 0
        errors = int(errors_match.group(1)) if errors_match else 0
        if failures > 0 or errors > 0:
            return "killed"
        return "blocked"

    if final_status == "ok" and run.returncode == 0:
        return "survived"

    return "blocked"


def calculate_mutation_score(killed, survived, timeout) -> float | None:
    killed = int(killed)
    survived = int(survived)
    timeout = int(timeout)
    denominator = killed + survived + timeout
    if denominator == 0:
        return None
    return killed / denominator * 100.0


def calculate_custom_detection_rate(results: list[dict]) -> float | None:
    killed = sum(result.get("verdict") == "killed" for result in results)
    survived = sum(result.get("verdict") == "survived" for result in results)
    denominator = killed + survived
    if denominator == 0:
        return None
    return killed / denominator * 100.0


def normalize_standard_stats(stats: dict) -> dict:
    """Normalize known mutmut export fields without inventing missing values."""
    normalized = dict(stats)
    nested = stats.get("stats")
    if isinstance(nested, dict):
        for key, value in nested.items():
            normalized.setdefault(key, value)

    if "excluded" not in normalized and "skipped" in normalized:
        normalized["excluded"] = normalized.get("skipped")
    if "blocked" not in normalized and "no_tests" in normalized:
        normalized["blocked"] = normalized.get("no_tests")

    for key in (
        "total",
        "killed",
        "survived",
        "timeout",
        "equivalent",
        "blocked",
        "excluded",
    ):
        value = normalized.get(key)
        if value is not None:
            normalized[key] = int(value)
    return normalized


def _count_standard_mutants(stats: dict | None) -> dict[str, int | None]:
    if not isinstance(stats, dict):
        return {
            "total": None,
            "killed": None,
            "survived": None,
            "timeout": None,
            "equivalent": None,
            "blocked": None,
            "excluded": None,
        }

    stats = normalize_standard_stats(stats)
    counts = {}
    for name in ("killed", "survived", "timeout", "equivalent", "blocked", "excluded"):
        value = stats.get(name)
        counts[name] = int(value) if value is not None else None

    if stats.get("total") is not None:
        counts["total"] = int(stats["total"])
    else:
        available = [
            counts[name]
            for name in (
                "killed",
                "survived",
                "timeout",
                "equivalent",
                "blocked",
                "excluded",
            )
            if counts[name] is not None
        ]
        counts["total"] = sum(available) if len(available) == 6 else None
    return counts


def save_mutation_summary(
    results_dir: Path,
    *,
    standard_status: str,
    standard_stats: dict | None,
    standard_reason: str | None = None,
    custom_results: list[dict] | None = None,
) -> dict:
    custom_results = custom_results or []
    if standard_stats is not None:
        standard_stats = normalize_standard_stats(standard_stats)
    standard_counts = _count_standard_mutants(
        standard_stats if standard_status == "measured" else None
    )

    standard_score = None
    standard_score_reason = None
    if standard_status != "measured":
        standard_score_reason = (
            standard_reason
            or "standard mutmut statistics were not measured"
        )
    elif standard_stats is None:
        standard_score_reason = "standard mutmut statistics are unavailable"
    else:
        if all(
            standard_stats.get(name) is not None
            for name in ("killed", "survived", "timeout")
        ):
            standard_score = calculate_mutation_score(
                standard_stats["killed"],
                standard_stats["survived"],
                standard_stats["timeout"],
            )
            if standard_score is None:
                standard_score_reason = "zero mutation score denominator"
        else:
            standard_score_reason = "standard mutmut statistics are incomplete"

    custom_counts = {
        "generated": len(custom_results),
        "killed": sum(
            result.get("verdict") == "killed" for result in custom_results
        ),
        "survived": sum(
            result.get("verdict") == "survived" for result in custom_results
        ),
        "timeout": sum(
            result.get("verdict") == "timeout" for result in custom_results
        ),
        "blocked": sum(
            result.get("verdict") == "blocked" for result in custom_results
        ),
    }
    custom_score = calculate_custom_detection_rate(custom_results)
    custom_score_reason = (
        None
        if custom_score is not None
        else "no measurable custom mutants"
    )

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "standard_mutmut_status": standard_status,
        "standard_mutmut_counts": standard_counts,
        "standard_mutation_score": standard_score,
        "standard_mutation_score_reason": standard_score_reason,
        "custom_operator_counts": custom_counts,
        "custom_detection_rate": custom_score,
        "custom_detection_rate_reason": custom_score_reason,
    }

    summary_path = results_dir / "mutation-summary.json"
    summary_path.write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )
    return summary


def print_mutation_summary(summary: dict) -> None:
    standard_counts = summary["standard_mutmut_counts"]

    def display_count(name: str) -> str:
        value = standard_counts[name]
        return str(value) if value is not None else "UNAVAILABLE"

    print("\n## MUTATION TESTING SUMMARY")
    print()
    print(f"- Total mutants generated: {display_count('total')}")
    print(f"- Killed: {display_count('killed')}")
    print(f"- Survived: {display_count('survived')}")
    print(f"- Timeout: {display_count('timeout')}")
    print(f"- Equivalent: {display_count('equivalent')}")
    print(f"- Blocked: {display_count('blocked')}")
    print(f"- Excluded: {display_count('excluded')}")

    standard_score = summary["standard_mutation_score"]
    if standard_score is None:
        print(
            "Standard mutation score: UNAVAILABLE "
            "\u2014 statistics collection failed."
        )
    else:
        print(f"Standard mutation score: {standard_score:.2f}%")

    custom_counts = summary["custom_operator_counts"]
    print()
    print(f"- Custom mutants generated: {custom_counts['generated']}")
    print(f"- Custom mutants killed: {custom_counts['killed']}")
    print(f"- Custom mutants survived: {custom_counts['survived']}")
    print(f"- Custom mutants blocked: {custom_counts['blocked']}")
    custom_score = summary["custom_detection_rate"]
    if custom_score is None:
        print("- Custom detection rate: UNAVAILABLE")
    else:
        print(f"- Custom detection rate: {custom_score:.2f}%")


def parse_mutmut_survivors(stdout: str, stderr: str) -> list[dict]:
    combined = f"{stdout}\n{stderr}"
    survivors = []
    seen = set()
    for line in combined.splitlines():
        lower = line.lower()
        if "surviv" not in lower:
            continue
        match = re.search(r"(?:mutant(?:\s+id)?\s*[#:]?\s*|^)(\d+)", line, re.I)
        mutant_id = match.group(1) if match else None
        key = mutant_id or line.strip()
        if key in seen:
            continue
        seen.add(key)
        survivors.append(
            {
                "mutant_id": mutant_id,
                "status": "survived",
                "evidence": line.strip(),
            }
        )
    return survivors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", required=True)
    parser.add_argument("--testing-root", required=True)
    parser.add_argument("--mutmut-bin", default="/.venv/bin/mutmut")
    parser.add_argument("--python-bin", default="/.venv/bin/python")
    parser.add_argument("--results-dir", required=True)
    args = parser.parse_args()

    source_root = Path(args.source_root).resolve()
    testing_root = Path(args.testing_root).resolve()
    results_dir = Path(args.results_dir).resolve()
    results_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="care-mutation-") as temp_name:
        temp = Path(temp_name)
        isolated_care = temp / "care"
        # The tests live INSIDE the project copy: mutmut runs pytest from its
        # mutants/ copy and names tests relative to that root, so tests outside
        # it cannot be re-selected per mutant ("file or directory not found").
        isolated_testing = isolated_care / "care_testing"
        shutil.copytree(source_root, isolated_care)
        shutil.copytree(testing_root, isolated_testing)

        config = isolated_care / "setup.cfg"
        config.write_text(
            "\n".join(
                (
                    "[mutmut]",
                    "source_paths =",
                    "    care/emr/api/viewsets/encounter.py",
                    "    care/emr/resources/encounter/spec.py",
                    # mutmut copies only source_paths into mutants/; Django also
                    # needs the settings package, the rest of the app and tests.
                    "also_copy =",
                    "    config",
                    "    care",
                    "    plugs",
                    "    manage.py",
                    "    plug_config.py",
                    "    install_plugins.py",
                    "    care_testing",
                    "pytest_add_cli_args =",
                    "    -q",
                    "    -p",
                    "    no:cacheprovider",
                    "pytest_add_cli_args_test_selection =",
                    "    care_testing/unit",
                    "    care_testing/integration",
                    "process_isolation = fork",
                    "debug = true",
                    "log_to_file = true",
                    "log_file_path = mutants/mutmut-debug.log",
                    "mutate_only_covered_lines = false",
                    "use_git_change_detection = false",
                    "",
                )
            ),
            encoding="utf-8",
        )

        env = {
            **os.environ,
            "PYTHONPATH": f"{isolated_care}",
            "DJANGO_SETTINGS_MODULE": "config.settings.test",
        }
        # mutmut must import the MUTATED copy in mutants/, so it gets no extra
        # PYTHONPATH that could shadow it with the original sources.
        mutmut_env = {k: v for k, v in env.items() if k != "PYTHONPATH"}

        probe = subprocess.run(
            [args.mutmut_bin, "results"],
            cwd=isolated_care,
            env=mutmut_env,
            capture_output=True,
            text=True,
        )
        (results_dir / "mutmut-config-discovery.json").write_text(
            json.dumps(
                {
                    "cwd": str(isolated_care),
                    "setup_cfg": str(config),
                    "setup_cfg_contents": config.read_text(encoding="utf-8"),
                    "source_paths": list(TARGETS),
                    "pytest_selection": [
                        str(isolated_testing / "unit"),
                        str(isolated_testing / "integration"),
                    ],
                    "probe_returncode": probe.returncode,
                    "probe_stdout": probe.stdout,
                    "probe_stderr": probe.stderr,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

        try:
            clean = subprocess.run(
                [
                    args.python_bin,
                    "manage.py",
                    "test",
                    "care_testing.unit",
                    "care_testing.integration",
                    "--keepdb",
                    "--verbosity=1",
                ],
                cwd=isolated_care,
                env=env,
                capture_output=True,
                text=True,
                timeout=600,
            )
        except subprocess.TimeoutExpired as exc:
            write_mutation_results(
                results_dir,
                {
                    "status": "blocked",
                    "reason": "clean independent Django test suite timed out",
                    "killed": None,
                    "survived": None,
                    "timeout": None,
                    "excluded": None,
                    "equivalent": None,
                    "operators": [op.operator_id for op in operator_catalog()],
                    "targets": list(TARGETS),
                    "stdout": exc.stdout or "",
                    "stderr": exc.stderr or "",
                },
            )
            (results_dir / "custom-mutant-results.json").write_text(
                json.dumps(
                    {
                        "status": "blocked",
                        "campaign": "custom-operators",
                        "reason": "clean independent Django tests timed out",
                        "results": [],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (results_dir / "custom-mutants-manifest.json").write_text(
                json.dumps(
                    [
                        {
                            "operator_id": op.operator_id,
                            "rule_id": op.rule_id,
                            "executed": False,
                            "verdict": "blocked",
                            "reason": "clean independent Django tests timed out",
                        }
                        for op in operator_catalog()
                    ],
                    indent=2,
                ),
                encoding="utf-8",
            )
            summary = save_mutation_summary(
                results_dir,
                standard_status="blocked",
                standard_stats=None,
                standard_reason="clean independent Django test suite timed out",
                custom_results=[],
            )
            print_mutation_summary(summary)
            return 1
        clean_discovery = clean_suite_discovery(clean)
        if not clean_discovery["discovered"] or not clean_discovery["completed"]:
            write_mutation_results(
                results_dir,
                {
                    "status": "blocked",
                    "reason": "clean independent Django test suite was not discovered or did not complete",
                    "clean_test_discovery": clean_discovery,
                    "killed": None,
                    "survived": None,
                    "timeout": None,
                    "excluded": None,
                    "equivalent": None,
                    "operators": [op.operator_id for op in operator_catalog()],
                    "targets": list(TARGETS),
                    "stdout": clean.stdout,
                    "stderr": clean.stderr,
                },
            )
            (results_dir / "custom-mutant-results.json").write_text(
                json.dumps(
                    {
                        "status": "blocked",
                        "campaign": "custom-operators",
                        "reason": "clean independent Django tests failed",
                        "results": [],
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            (results_dir / "custom-mutants-manifest.json").write_text(
                json.dumps(
                    [
                        {
                            "operator_id": op.operator_id,
                            "rule_id": op.rule_id,
                            "executed": False,
                            "verdict": "blocked",
                            "reason": "clean independent Django tests failed",
                        }
                        for op in operator_catalog()
                    ],
                    indent=2,
                ),
                encoding="utf-8",
            )
            summary = save_mutation_summary(
                results_dir,
                standard_status="blocked",
                standard_stats=None,
                standard_reason="clean independent Django test suite was not discovered or did not complete",
                custom_results=[],
            )
            print_mutation_summary(summary)
            return 1

        custom_results = []
        custom_manifest = []
        custom_root = results_dir / "custom-mutants"
        custom_root.mkdir(parents=True, exist_ok=True)

        for operator in operator_catalog():
            custom_dir = Path(tempfile.mkdtemp(prefix=f"{operator.operator_id}-", dir=temp))
            custom_care = custom_dir / "care"
            custom_testing = custom_dir / "care_testing"
            shutil.copytree(source_root, custom_care)
            shutil.copytree(testing_root, custom_testing)
            shutil.copy2(config, custom_care / "setup.cfg")

            target_relative = (
                "care/emr/api/viewsets/encounter.py"
                if operator.rule_id in {"BR-ENC-01", "BR-ENC-06"}
                else "care/emr/resources/encounter/spec.py"
            )
            target = custom_care / target_relative
            original_source = target.read_text(encoding="utf-8")
            try:
                mutated = apply_operator(
                    original_source,
                    operator.operator_id,
                )
            except (RuntimeError, ValueError) as exc:
                target.write_text(original_source, encoding="utf-8")
                result = {
                    "operator_id": operator.operator_id,
                    "rule_id": operator.rule_id,
                    "target": target_relative,
                    "verdict": "blocked",
                    "executed": False,
                    "returncode": None,
                    "stdout": "",
                    "stderr": str(exc),
                }
                custom_results.append(result)
                custom_manifest.append(
                    {
                        "operator_id": operator.operator_id,
                        "rule_id": operator.rule_id,
                        "target": target_relative,
                        "source_mutation_copy": None,
                        "executed": False,
                        "verdict": "blocked",
                        "reason": str(exc),
                    }
                )
                continue
            output = custom_root / f"{operator.operator_id}.py"
            output.write_text(mutated, encoding="utf-8")
            target.write_text(mutated, encoding="utf-8")

            custom_env = {
                **os.environ,
                "PYTHONPATH": f"{custom_dir}:{custom_care}",
                "DJANGO_SETTINGS_MODULE": "config.settings.test",
            }
            try:
                try:
                    run = subprocess.run(
                        [
                            args.python_bin,
                            "manage.py",
                            "test",
                            "care_testing.unit",
                            "care_testing.integration",
                            "--keepdb",
                            "--verbosity=1",
                        ],
                        cwd=custom_care,
                        env=custom_env,
                        capture_output=True,
                        text=True,
                        timeout=600,
                    )
                    verdict = classify_custom_run(run)
                    result = {
                        "operator_id": operator.operator_id,
                        "rule_id": operator.rule_id,
                        "target": target_relative,
                        "verdict": verdict,
                        "executed": True,
                        "returncode": run.returncode,
                        "stdout": run.stdout,
                        "stderr": run.stderr,
                    }
                except subprocess.TimeoutExpired as exc:
                    result = {
                        "operator_id": operator.operator_id,
                        "rule_id": operator.rule_id,
                        "target": target_relative,
                        "verdict": "timeout",
                        "executed": True,
                        "returncode": None,
                        "stdout": exc.stdout or "",
                        "stderr": exc.stderr or "",
                    }
            finally:
                target.write_text(original_source, encoding="utf-8")

            custom_results.append(result)
            custom_manifest.append(
                {
                    "operator_id": operator.operator_id,
                    "rule_id": operator.rule_id,
                    "target": target_relative,
                    "source_mutation_copy": str(output),
                    "executed": True,
                    "verdict": result["verdict"],
                }
            )

        (results_dir / "custom-mutant-results.json").write_text(
            json.dumps(
                {
                    "status": "measured",
                    "campaign": "custom-operators",
                    "results": custom_results,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        (results_dir / "custom-mutants-manifest.json").write_text(
            json.dumps(custom_manifest, indent=2),
            encoding="utf-8",
        )

        try:
            standard = subprocess.run(
                # One worker: Django TestCases share one test database and
                # CARE's Redis encounter-create lock, so parallel workers
                # interfere and produce false kills.
                [args.mutmut_bin, "run", "--max-children", "1"],
                cwd=isolated_care,
                env=mutmut_env,
                capture_output=True,
                text=True,
                timeout=7200,
            )
        except subprocess.TimeoutExpired as exc:
            write_mutation_results(
                results_dir,
                {
                    "status": "blocked",
                    "reason": "standard mutmut run timed out",
                    "killed": None,
                    "survived": None,
                    "timeout": None,
                    "excluded": None,
                    "equivalent": None,
                    "stdout": exc.stdout or "",
                    "stderr": exc.stderr or "",
                },
            )
            summary = save_mutation_summary(
                results_dir,
                standard_status="blocked",
                standard_stats=None,
                standard_reason="standard mutmut run timed out",
                custom_results=custom_results,
            )
            print_mutation_summary(summary)
            return 1

        (results_dir / "mutmut-standard-run.json").write_text(
            json.dumps(
                {
                    "returncode": standard.returncode,
                    "stdout": standard.stdout,
                    "stderr": standard.stderr,
                    "debug_log": (
                        (isolated_care / "mutants" / "mutmut-debug.log").read_text(
                            encoding="utf-8",
                            errors="replace",
                        )
                        if (isolated_care / "mutants" / "mutmut-debug.log").exists()
                        else ""
                    ),
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        debug_log_path = isolated_care / "mutants" / "mutmut-debug.log"
        debug_log = (
            debug_log_path.read_text(encoding="utf-8", errors="replace")
            if debug_log_path.exists()
            else ""
        )
        if debug_log_path.exists():
            shutil.copy2(debug_log_path, results_dir / "mutmut-debug.log")
        export = subprocess.run(
            [args.mutmut_bin, "export-cicd-stats"],
            cwd=isolated_care,
            env=mutmut_env,
            capture_output=True,
            text=True,
        )
        if export.returncode != 0:
            write_mutation_results(
                results_dir,
                {
                    "status": "blocked",
                    "reason": "mutmut export-cicd-stats failed",
                    "killed": None,
                    "survived": None,
                    "timeout": None,
                    "excluded": None,
                    "equivalent": None,
                    "returncode": export.returncode,
                    "stdout": export.stdout,
                    "stderr": export.stderr,
                    "debug_log": debug_log,
                },
            )
            summary = save_mutation_summary(
                results_dir,
                standard_status="blocked",
                standard_stats=None,
                standard_reason="mutmut export-cicd-stats failed",
                custom_results=custom_results,
            )
            print_mutation_summary(summary)
            return 1

        stats_file = isolated_care / "mutants" / "mutmut-cicd-stats.json"
        if standard.returncode != 0:
            write_mutation_results(
                results_dir,
                {
                    "status": "blocked",
                    "reason": "mutmut run did not complete successfully",
                    "returncode": standard.returncode,
                    "killed": None,
                    "survived": None,
                    "timeout": None,
                    "excluded": None,
                    "equivalent": None,
                    "stdout": standard.stdout,
                    "stderr": standard.stderr,
                    "debug_log": debug_log,
                    "targets": list(TARGETS),
                },
            )
            summary = save_mutation_summary(
                results_dir,
                standard_status="blocked",
                standard_stats=None,
                standard_reason="mutmut run did not complete successfully",
                custom_results=custom_results,
            )
            print_mutation_summary(summary)
            return 1

        if not stats_file.exists():
            write_mutation_results(
                results_dir,
                {
                    "status": "blocked",
                    "reason": "mutmut did not produce mutmut-cicd-stats.json",
                    "killed": None,
                    "survived": None,
                    "timeout": None,
                    "excluded": None,
                    "equivalent": None,
                },
            )
            summary = save_mutation_summary(
                results_dir,
                standard_status="blocked",
                standard_stats=None,
                standard_reason="mutmut did not produce mutmut-cicd-stats.json",
                custom_results=custom_results,
            )
            print_mutation_summary(summary)
            return 1

        measured = json.loads(stats_file.read_text(encoding="utf-8"))
        shutil.copy2(stats_file, results_dir / "mutmut-cicd-stats.json")
        measured["status"] = "measured"
        measured["campaign"] = "standard-mutmut"
        measured = normalize_standard_stats(measured)
        write_mutation_results(results_dir, measured)

        survivor_probe = subprocess.run(
            [args.mutmut_bin, "results"],
            cwd=isolated_care,
            env=mutmut_env,
            capture_output=True,
            text=True,
        )
        survivor_records = parse_mutmut_survivors(
            survivor_probe.stdout,
            survivor_probe.stderr,
        )
        reported_survivors = int(measured.get("survived", 0) or 0)
        if reported_survivors > 0:
            (results_dir / "surviving-mutants.json").write_text(
                json.dumps(
                    {
                        "status": "measured",
                        "campaign": "standard-mutmut",
                        "actual_survivor_count": reported_survivors,
                        "analysed_survivor_count": len(survivor_records),
                        "analyses": survivor_records,
                        "analysis_complete": len(survivor_records) >= reported_survivors,
                        "stdout": survivor_probe.stdout,
                        "stderr": survivor_probe.stderr,
                        "returncode": survivor_probe.returncode,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        summary = save_mutation_summary(
            results_dir,
            standard_status="measured",
            standard_stats=measured,
            custom_results=custom_results,
        )
        print_mutation_summary(summary)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
