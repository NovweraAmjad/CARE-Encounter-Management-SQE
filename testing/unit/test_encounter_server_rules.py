import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings
from pydantic import ValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.utils import timezone

from care.emr.api.viewsets.encounter import EncounterViewSet
from care.emr.models import Encounter
from care.emr.resources.encounter.constants import (
    COMPLETED_CHOICES,
    StatusChoices,
)
from care.emr.resources.encounter.spec import (
    EncounterCreateSpec,
    EncounterUpdateSpec,
)
from care.emr.resources.base import PeriodSpec


class ActiveEncounterLimitUnitTests(SimpleTestCase):
    def _viewset_for_counts(self, active_count):
        viewset = EncounterViewSet()
        instance = SimpleNamespace(
            patient=uuid.uuid4(),
            facility=uuid.uuid4(),
        )

        filtered = MagicMock()
        filtered.exclude.return_value.count.return_value = active_count
        return viewset, instance, filtered

    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=5)
    def test_active_count_boundaries_call_actual_validation(self):
        for active_count in (0, 4, 5, 6):
            with self.subTest(active_count=active_count):
                viewset, instance, filtered = self._viewset_for_counts(active_count)
                with (
                    patch.object(
                        viewset.database_model.objects,
                        "filter",
                        return_value=filtered,
                    ),
                    patch(
                        "care.emr.api.viewsets.encounter.Patient.objects.filter",
                        return_value=SimpleNamespace(exists=lambda: True),
                    ),
                    patch(
                        "care.emr.api.viewsets.encounter.Facility.objects.filter",
                        return_value=SimpleNamespace(exists=lambda: True),
                    ),
                ):
                    if active_count >= 5:
                        with self.assertRaisesMessage(
                            DRFValidationError,
                            "Patient already has maximum number",
                        ):
                            viewset.validate_data(instance)
                    else:
                        viewset.validate_data(instance)

                filtered.exclude.assert_called_once_with(
                    status__in=COMPLETED_CHOICES
                )

    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=5)
    def test_terminal_statuses_are_passed_to_exclusion_query(self):
        viewset, instance, filtered = self._viewset_for_counts(0)
        with (
            patch.object(
                viewset.database_model.objects,
                "filter",
                return_value=filtered,
            ),
            patch(
                "care.emr.api.viewsets.encounter.Patient.objects.filter",
                return_value=SimpleNamespace(exists=lambda: True),
            ),
            patch(
                "care.emr.api.viewsets.encounter.Facility.objects.filter",
                return_value=SimpleNamespace(exists=lambda: True),
            ),
        ):
            viewset.validate_data(instance)

        excluded_statuses = filtered.exclude.call_args.kwargs["status__in"]
        self.assertCountEqual(
            excluded_statuses,
            [
                "completed",
                "cancelled",
                "entered_in_error",
                "discontinued",
            ],
        )

    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=5)
    def test_nonexistent_patient_uuid_is_rejected_by_actual_validation(self):
        viewset, instance, filtered = self._viewset_for_counts(0)
        with (
            patch.object(
                viewset.database_model.objects,
                "filter",
                return_value=filtered,
            ),
            patch(
                "care.emr.api.viewsets.encounter.Patient.objects.filter",
                return_value=SimpleNamespace(exists=lambda: False),
            ),
        ):
            # Exact message (assertRaisesMessage only checks a substring, which
            # let a mutated "XXPatient does not existXX" message survive mutation testing).
            with self.assertRaises(DRFValidationError) as raised:
                viewset.validate_data(instance)
            self.assertEqual([str(m) for m in raised.exception.detail], ["Patient does not exist"])

    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=5)
    def test_nonexistent_facility_uuid_is_rejected_by_actual_validation(self):
        viewset, instance, filtered = self._viewset_for_counts(0)
        with (
            patch.object(
                viewset.database_model.objects,
                "filter",
                return_value=filtered,
            ),
            patch(
                "care.emr.api.viewsets.encounter.Patient.objects.filter",
                return_value=SimpleNamespace(exists=lambda: True),
            ),
            patch(
                "care.emr.api.viewsets.encounter.Facility.objects.filter",
                return_value=SimpleNamespace(exists=lambda: False),
            ),
        ):
            # Exact message (assertRaisesMessage only checks a substring, which
            # let a mutated "XXFacility does not existXX" message survive mutation testing).
            with self.assertRaises(DRFValidationError) as raised:
                viewset.validate_data(instance)
            self.assertEqual([str(m) for m in raised.exception.detail], ["Facility does not exist"])

    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=5)
    def test_update_skips_create_only_active_limit_validation(self):
        viewset, instance, filtered = self._viewset_for_counts(6)
        model_obj = SimpleNamespace(id=uuid.uuid4())
        with patch.object(
            viewset.database_model.objects,
            "filter",
            return_value=filtered,
        ) as objects_filter:
            viewset.validate_data(instance, model_obj=model_obj)

        objects_filter.assert_not_called()


class StatusHistorySpecUnitTests(SimpleTestCase):
    def _create_spec(self, status="in_progress"):
        return EncounterCreateSpec.model_validate(
            {
                "patient": str(uuid.uuid4()),
                "facility": str(uuid.uuid4()),
                "status": status,
                "encounter_class": "imp",
                "priority": "routine",
                "period": {},
                "hospitalization": None,
            }
        )

    def test_create_initial_history_has_exactly_one_status_and_timestamp(self):
        spec = self._create_spec("in_progress")
        obj = SimpleNamespace(status=StatusChoices.in_progress.value)

        with patch(
            "care.emr.resources.encounter.spec.get_object_or_404",
            side_effect=[SimpleNamespace(id=1), SimpleNamespace(id=2)],
        ):
            spec.perform_extra_deserialization(False, obj)

        self.assertEqual(len(obj.status_history["history"]), 1)
        entry = obj.status_history["history"][0]
        self.assertEqual(entry["status"], "in_progress")
        self.assertIsInstance(entry["moved_at"], str)
        self.assertTrue(entry["moved_at"])

    def test_changed_status_appends_exactly_one_history_entry(self):
        spec = EncounterUpdateSpec.model_validate(
            {
                "status": "completed",
                "period": {},
                "hospitalization": None,
                "priority": "routine",
                "discharge_summary_advice": None,
            }
        )
        obj = SimpleNamespace(
            id=uuid.uuid4(),
            status="completed",
            status_history={"history": [{"status": "in_progress", "moved_at": "old"}]},
            discharge_summary_advice="",
        )

        with patch.object(
            Encounter.objects,
            "get",
            return_value=SimpleNamespace(status="in_progress"),
        ):
            spec.perform_extra_deserialization(True, obj)

        self.assertEqual(len(obj.status_history["history"]), 2)
        self.assertEqual(obj.status_history["history"][-1]["status"], "completed")
        self.assertTrue(obj.status_history["history"][-1]["moved_at"])
        self.assertIsNone(obj.discharge_summary_advice)

    def test_changed_status_history_entry_has_no_extra_entries(self):
        spec = EncounterUpdateSpec.model_validate(
            {
                "status": "completed",
                "period": {},
                "hospitalization": None,
                "priority": "routine",
                "discharge_summary_advice": None,
            }
        )
        original_history = {
            "history": [{"status": "in_progress", "moved_at": "old"}]
        }
        obj = SimpleNamespace(
            id=uuid.uuid4(),
            status="completed",
            status_history=original_history,
            discharge_summary_advice="old advice",
        )

        with patch.object(
            Encounter.objects,
            "get",
            return_value=SimpleNamespace(status="in_progress"),
        ):
            spec.perform_extra_deserialization(True, obj)

        self.assertEqual(len(obj.status_history["history"]), 2)
        self.assertEqual(
            obj.status_history["history"][0],
            {"status": "in_progress", "moved_at": "old"},
        )
        self.assertEqual(obj.status_history["history"][-1]["status"], "completed")
        self.assertIsNone(obj.discharge_summary_advice)

    def test_unchanged_status_does_not_append_history_entry(self):
        spec = EncounterUpdateSpec.model_validate(
            {
                "status": "in_progress",
                "period": {},
                "hospitalization": None,
                "priority": "routine",
                "discharge_summary_advice": "",
            }
        )
        obj = SimpleNamespace(
            id=uuid.uuid4(),
            status="in_progress",
            status_history={"history": [{"status": "in_progress", "moved_at": "old"}]},
            discharge_summary_advice="",
        )

        with patch.object(
            Encounter.objects,
            "get",
            return_value=SimpleNamespace(status="in_progress"),
        ):
            spec.perform_extra_deserialization(True, obj)

        self.assertEqual(len(obj.status_history["history"]), 1)

    def test_actual_pydantic_validation_rejects_invalid_status(self):
        with self.assertRaises(ValidationError):
            self._create_spec("not_a_status")

    def test_create_spec_update_call_skips_create_only_history_initialization(self):
        spec = self._create_spec("planned")
        obj = SimpleNamespace(status="planned")
        spec.perform_extra_deserialization(True, obj)
        self.assertFalse(hasattr(obj, "status_history"))

    def test_create_spec_with_appointment_runs_appointment_branch(self):
        spec = EncounterCreateSpec.model_validate(
            {
                "patient": str(uuid.uuid4()),
                "facility": str(uuid.uuid4()),
                "appointment": str(uuid.uuid4()),
                "status": "planned",
                "encounter_class": "amb",
                "priority": "routine",
                "period": {},
                "hospitalization": None,
            }
        )
        obj = SimpleNamespace(status="planned")
        resolved = iter(
            [
                SimpleNamespace(id=1),
                SimpleNamespace(id=2),
                SimpleNamespace(id=3),
            ]
        )
        with patch(
            "care.emr.resources.encounter.spec.get_object_or_404",
            side_effect=lambda *args, **kwargs: next(resolved),
        ):
            spec.perform_extra_deserialization(False, obj)

        self.assertEqual(len(obj.status_history["history"]), 1)
        self.assertEqual(obj.appointment.id, 3)


class CompletionPeriodUnitTests(SimpleTestCase):
    def test_aware_start_and_end_are_accepted(self):
        start = timezone.now() - timedelta(hours=2)
        end = timezone.now()
        period = PeriodSpec.model_validate(
            {"start": start.isoformat(), "end": end.isoformat()}
        )
        self.assertEqual(period.start, start)
        self.assertEqual(period.end, end)

    def test_equal_start_and_end_are_accepted(self):
        boundary = timezone.now()
        period = PeriodSpec.model_validate(
            {"start": boundary.isoformat(), "end": boundary.isoformat()}
        )
        self.assertEqual(period.start, period.end)

    def test_missing_end_is_accepted_without_populating_it(self):
        period = PeriodSpec.model_validate(
            {"start": timezone.now().isoformat(), "end": None}
        )
        self.assertIsNotNone(period.start)
        self.assertIsNone(period.end)

    def test_naive_start_is_rejected(self):
        with self.assertRaisesMessage(
            ValidationError,
            "Start Date must be timezone aware",
        ):
            PeriodSpec.model_validate(
                {"start": "2026-11-27T10:00:00", "end": None}
            )

    def test_naive_end_is_rejected(self):
        with self.assertRaisesMessage(
            ValidationError,
            "End Date must be timezone aware",
        ):
            PeriodSpec.model_validate(
                {
                    "start": timezone.now().isoformat(),
                    "end": "2026-11-27T10:00:00",
                }
            )

    def test_start_after_end_is_rejected(self):
        start = timezone.now()
        end = start - timedelta(hours=1)
        with self.assertRaisesMessage(
            ValidationError,
            "Start Date cannot be greater than End Date",
        ):
            PeriodSpec.model_validate(
                {"start": start.isoformat(), "end": end.isoformat()}
            )
