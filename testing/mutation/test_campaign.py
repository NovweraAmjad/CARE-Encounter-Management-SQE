import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase


MUTATION_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(MUTATION_DIR))

from campaign import (
    calculate_custom_detection_rate,
    calculate_mutation_score,
    classify_custom_run,
    save_mutation_summary,
)
from custom_operators import apply_operator


class ClassifyCustomRunTests(TestCase):
    def test_failed_with_failures_only_is_killed(self):
        run = SimpleNamespace(
            returncode=1,
            stdout="Ran 46 tests in 1.250s\nFAILED (failures=18)",
            stderr="",
        )
        self.assertEqual(classify_custom_run(run), "killed")

    def test_failed_with_failures_and_errors_is_killed(self):
        run = SimpleNamespace(
            returncode=1,
            stdout="Ran 46 tests in 1.250s\nFAILED (failures=18, errors=3)",
            stderr="",
        )
        self.assertEqual(classify_custom_run(run), "killed")

    def test_ok_with_zero_return_code_is_survived(self):
        run = SimpleNamespace(
            returncode=0,
            stdout="Ran 46 tests in 1.250s\nOK",
            stderr="",
        )
        self.assertEqual(classify_custom_run(run), "survived")

    def test_import_collection_failure_without_completed_run_is_blocked(self):
        run = SimpleNamespace(
            returncode=1,
            stdout="ImportError: cannot import test module",
            stderr="ModuleNotFoundError: No module named 'missing_test_dependency'",
        )
        self.assertEqual(classify_custom_run(run), "blocked")


class CustomOperatorTests(TestCase):
    def test_active_limit_operator_changes_gte_to_lte(self):
        source = (
            "def validate(active_count):\n"
            "    if active_count.count() >= 5:\n"
            "        return True\n"
            "    return False\n"
        )
        mutated = apply_operator(
            source,
            "BR01_ACTIVE_LIMIT_COMPARISON",
        )
        self.assertIn("<= 5", mutated)
        self.assertNotIn(">= 5", mutated)

    def test_restart_operator_changes_elapsed_comparison(self):
        source = (
            "def eligible(instance, elapsed):\n"
            "    if instance.modified_date < elapsed:\n"
            "        return True\n"
            "    return False\n"
        )
        mutated = apply_operator(
            source,
            "BR06_RESTART_ELAPSED_TIME",
        )
        self.assertIn("instance.modified_date > elapsed", mutated)

    def test_status_history_operator_changes_not_equal_to_equal(self):
        source = (
            "def changed(old_status, new_status):\n"
            "    if old_status != new_status:\n"
            "        return True\n"
            "    return False\n"
        )
        mutated = apply_operator(
            source,
            "BR03_STATUS_HISTORY_CHANGE",
        )
        self.assertIn("old_status == new_status", mutated)


class MutationReportingTests(TestCase):
    def test_normal_mutation_score_calculation(self):
        self.assertAlmostEqual(calculate_mutation_score(8, 2, 0), 80.0)

    def test_zero_mutation_score_denominator(self):
        self.assertIsNone(calculate_mutation_score(0, 0, 0))

    def test_equivalent_mutants_are_excluded(self):
        with tempfile.TemporaryDirectory() as temp_name:
            summary = save_mutation_summary(
                Path(temp_name),
                standard_status="measured",
                standard_stats={
                    "killed": 3,
                    "survived": 1,
                    "timeout": 0,
                    "equivalent": 10,
                    "blocked": 0,
                    "excluded": 0,
                },
            )
        self.assertAlmostEqual(summary["standard_mutation_score"], 75.0)

    def test_timeout_mutants_are_in_denominator(self):
        self.assertAlmostEqual(
            calculate_mutation_score(3, 1, 2),
            50.0,
        )

    def test_blocked_mutants_are_excluded(self):
        with tempfile.TemporaryDirectory() as temp_name:
            summary = save_mutation_summary(
                Path(temp_name),
                standard_status="measured",
                standard_stats={
                    "killed": 4,
                    "survived": 1,
                    "timeout": 0,
                    "equivalent": 0,
                    "blocked": 10,
                    "excluded": 0,
                },
            )
        self.assertAlmostEqual(summary["standard_mutation_score"], 80.0)

    def test_excluded_mutants_are_excluded(self):
        with tempfile.TemporaryDirectory() as temp_name:
            summary = save_mutation_summary(
                Path(temp_name),
                standard_status="measured",
                standard_stats={
                    "killed": 4,
                    "survived": 1,
                    "timeout": 0,
                    "equivalent": 0,
                    "blocked": 0,
                    "excluded": 10,
                },
            )
        self.assertAlmostEqual(summary["standard_mutation_score"], 80.0)

    def test_standard_mutmut_failure_results_in_unavailable_score(self):
        with tempfile.TemporaryDirectory() as temp_name:
            summary = save_mutation_summary(
                Path(temp_name),
                standard_status="blocked",
                standard_stats=None,
                standard_reason="mutmut run did not complete successfully",
                custom_results=[],
            )

        self.assertIsNone(summary["standard_mutation_score"])
        self.assertIn(
            "mutmut run did not complete successfully",
            summary["standard_mutation_score_reason"],
        )

    def test_custom_detection_rate_is_calculated_independently(self):
        results = [
            {"verdict": "killed"},
            {"verdict": "killed"},
            {"verdict": "survived"},
            {"verdict": "blocked"},
            {"verdict": "timeout"},
        ]
        self.assertAlmostEqual(
            calculate_custom_detection_rate(results),
            66.66666666666666,
        )
