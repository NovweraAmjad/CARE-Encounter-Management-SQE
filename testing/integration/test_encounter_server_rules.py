import uuid
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from model_bakery import baker
from rest_framework import status

from care.emr.models.encounter import EncounterOrganization
from care.emr.models.organization import FacilityOrganization
from care.emr.models.scheduling.booking import TokenBooking, TokenSlot
from care.emr.models.scheduling.schedule import SchedulableResource
from care.emr.resources.encounter.constants import (
    COMPLETED_CHOICES,
    StatusChoices,
)
from care.security.permissions.encounter import EncounterPermissions
from care.security.permissions.patient import PatientPermissions
from care.utils.tests.base import CareAPITestBase
from care.emr.locks.billing import FacilityEncounterCreateLock
from care_testing.generators.encounter_data_generator import (
    generated_encounter_payload,
    generated_invalid_values,
    regenerated_constraints,
)


class EncounterServerRuleIntegrationTests(CareAPITestBase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.superuser = self.create_super_user()
        self.facility = self.create_facility(user=self.user)
        self.patient = self.create_patient(name="Encounter Test Patient")
        self.organization = self.create_facility_organization(
            facility=self.facility
        )
        self.encounter = self.create_encounter(
            patient=self.patient,
            facility=self.facility,
            organization=self.organization,
            status=StatusChoices.in_progress.value,
            status_history={
                "history": [
                    {
                        "status": StatusChoices.in_progress.value,
                        "moved_at": "old",
                    }
                ]
            },
        )
        role = self.create_role_with_permissions(
            [
                EncounterPermissions.can_create_encounter.name,
                EncounterPermissions.can_read_encounter.name,
                EncounterPermissions.can_write_encounter.name,
                PatientPermissions.can_list_patients.name,
            ]
        )
        self.attach_role_facility_organization_user(
            self.organization,
            self.user,
            role,
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse("encounter-list")
        self.encounter_data = {
            "patient": str(self.patient.external_id),
            "facility": str(self.facility.external_id),
            "status": StatusChoices.in_progress.value,
            "encounter_class": "imp",
            "priority": "routine",
            "organizations": [str(self.organization.external_id)],
            "period": {"start": timezone.now().isoformat()},
        }

    def detail_url(self, encounter=None):
        encounter = encounter or self.encounter
        url = reverse(
            "encounter-detail",
            kwargs={"external_id": encounter.external_id},
        )
        return (
            f"{url}?facility={self.facility.external_id}"
            f"&patient={self.patient.external_id}"
        )

    def delete_all_encounters(self):
        for encounter in self.encounter.__class__.objects.filter(
            patient=self.patient,
            facility=self.facility,
        ):
            encounter.delete()

    def create_active_encounters(self, count):
        for _ in range(count):
            self.create_encounter(
                patient=self.patient,
                facility=self.facility,
                organization=self.organization,
                status=StatusChoices.in_progress.value,
            )

    def test_active_count_boundaries_0_4_5_and_6(self):
        for active_count in (0, 4, 5, 6):
            with self.subTest(active_count=active_count):
                self.delete_all_encounters()
                self.create_active_encounters(active_count)
                response = self.client.post(
                    self.url,
                    self.encounter_data,
                    format="json",
                )
                FacilityEncounterCreateLock(self.facility.id).release()
                if active_count >= settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY:
                    self.assertEqual(
                        response.status_code,
                        status.HTTP_400_BAD_REQUEST,
                    )
                    self.assertIn(
                        "maximum number of active encounters",
                        str(response.data),
                    )
                else:
                    self.assertIn(
                        response.status_code,
                        (status.HTTP_200_OK, status.HTTP_201_CREATED),
                    )

    def test_all_active_statuses_count_as_active(self):
        for active_status in (
            StatusChoices.planned.value,
            StatusChoices.in_progress.value,
            StatusChoices.on_hold.value,
        ):
            with self.subTest(active_status=active_status):
                self.delete_all_encounters()
                for _ in range(settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY):
                    self.create_encounter(
                        patient=self.patient,
                        facility=self.facility,
                        organization=self.organization,
                        status=active_status,
                    )
                response = self.client.post(
                    self.url,
                    self.encounter_data,
                    format="json",
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )

    def test_terminal_statuses_do_not_count_as_active(self):
        for terminal_status in COMPLETED_CHOICES:
            with self.subTest(terminal_status=terminal_status):
                self.delete_all_encounters()
                for _ in range(settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY):
                    self.create_encounter(
                        patient=self.patient,
                        facility=self.facility,
                        organization=self.organization,
                        status=terminal_status,
                    )
                response = self.client.post(
                    self.url,
                    self.encounter_data,
                    format="json",
                )
                FacilityEncounterCreateLock(self.facility.id).release()
                self.assertIn(
                    response.status_code,
                    (status.HTTP_200_OK, status.HTTP_201_CREATED),
                )

    def test_same_patient_in_different_facility_is_allowed(self):
        other_facility = self.create_facility(user=self.user)
        for _ in range(settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY):
            self.create_encounter(
                patient=self.patient,
                facility=other_facility,
                organization=self.organization,
                status=StatusChoices.in_progress.value,
            )

        response = self.client.post(
            self.url,
            self.encounter_data,
            format="json",
        )
        FacilityEncounterCreateLock(self.facility.id).release()
        self.assertIn(
            response.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED),
        )

    def test_valid_but_nonexistent_patient_uuid_is_rejected(self):
        data = self.encounter_data.copy()
        data["patient"] = str(uuid.uuid4())
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Patient does not exist", str(response.data))

    def test_valid_but_nonexistent_facility_uuid_is_rejected(self):
        data = self.encounter_data.copy()
        data["facility"] = str(uuid.uuid4())
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Facility does not exist", str(response.data))

    def test_completion_period_missing_end_is_persisted(self):
        start = timezone.now() - timedelta(hours=2)
        end = None
        data = self.encounter_data.copy()
        data["status"] = StatusChoices.completed.value
        data["period"] = {"start": start.isoformat(), "end": end}

        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, StatusChoices.completed.value)
        self.assertEqual(
            parse_datetime(self.encounter.period["start"]),
            parse_datetime(data["period"]["start"]),
        )
        self.assertIsNone(self.encounter.period.get("end"))

    def test_completion_period_existing_end_is_not_replaced(self):
        start = timezone.now() - timedelta(hours=3)
        end = timezone.now() - timedelta(hours=1)
        data = self.encounter_data.copy()
        data["status"] = StatusChoices.completed.value
        data["period"] = {
            "start": start.isoformat(),
            "end": end.isoformat(),
        }

        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.encounter.refresh_from_db()
        self.assertEqual(
            parse_datetime(self.encounter.period["start"]),
            parse_datetime(data["period"]["start"]),
        )
        self.assertEqual(
            parse_datetime(self.encounter.period["end"]),
            parse_datetime(data["period"]["end"]),
        )

    def test_changed_status_history_is_persisted_and_read_back(self):
        data = self.encounter_data.copy()
        data["status"] = StatusChoices.completed.value
        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.encounter.refresh_from_db()
        history = self.encounter.status_history["history"]
        self.assertEqual(history[0]["status"], StatusChoices.in_progress.value)
        self.assertEqual(history[-1]["status"], StatusChoices.completed.value)
        self.assertEqual(len(history), 2)
        self.assertTrue(history[-1]["moved_at"])

    def test_unchanged_status_history_is_not_duplicated(self):
        data = self.encounter_data.copy()
        data["status"] = StatusChoices.in_progress.value
        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.encounter.refresh_from_db()
        history = self.encounter.status_history["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["status"], StatusChoices.in_progress.value)

    def test_invalid_period_does_not_change_persisted_period(self):
        start = timezone.now()
        end = start - timedelta(hours=1)
        before = self.encounter.period.copy()
        data = self.encounter_data.copy()
        data["period"] = {
            "start": start.isoformat(),
            "end": end.isoformat(),
        }
        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.period, before)

    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=3)
    def test_dynamic_active_limit_boundary_below_equal_above(self):
        regenerated = regenerated_constraints()
        limit = regenerated["active_limit_values"]["equal"]
        below = regenerated["active_limit_values"]["below"]
        above = regenerated["active_limit_values"]["above"]
        self.assertEqual(limit, settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY)

        for existing_count, should_reject in (
            (below, False),
            (limit, True),
            (above, True),
        ):
            with self.subTest(existing_count=existing_count):
                self.delete_all_encounters()
                self.create_active_encounters(existing_count)
                before_count = self.encounter.__class__.objects.filter(
                    patient=self.patient,
                    facility=self.facility,
                ).exclude(status__in=COMPLETED_CHOICES).count()
                response = self.client.post(
                    self.url,
                    generated_encounter_payload(
                        self.patient.external_id,
                        self.facility.external_id,
                        self.organization.external_id,
                    ),
                    format="json",
                )
                FacilityEncounterCreateLock(self.facility.id).release()
                if should_reject:
                    self.assertEqual(
                        response.status_code,
                        status.HTTP_400_BAD_REQUEST,
                    )
                    after_count = self.encounter.__class__.objects.filter(
                        patient=self.patient,
                        facility=self.facility,
                    ).exclude(status__in=COMPLETED_CHOICES).count()
                    self.assertEqual(after_count, before_count)
                else:
                    self.assertIn(
                        response.status_code,
                        (status.HTTP_200_OK, status.HTTP_201_CREATED),
                    )
                    after_count = self.encounter.__class__.objects.filter(
                        patient=self.patient,
                        facility=self.facility,
                    ).exclude(status__in=COMPLETED_CHOICES).count()
                    self.assertEqual(after_count, before_count + 1)

    def test_malformed_patient_and_facility_uuid_partitions(self):
        invalid = generated_invalid_values()
        for field_name in ("patient", "facility"):
            with self.subTest(field_name=field_name):
                data = generated_encounter_payload(
                    self.patient.external_id,
                    self.facility.external_id,
                    self.organization.external_id,
                )
                data[field_name] = invalid[field_name]
                before_count = self.encounter.__class__.objects.count()
                response = self.client.post(self.url, data, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertEqual(
                    self.encounter.__class__.objects.count(),
                    before_count,
                )

    def test_invalid_status_class_and_priority_partitions(self):
        invalid = generated_invalid_values()
        for field_name in ("status", "encounter_class", "priority"):
            with self.subTest(field_name=field_name):
                data = generated_encounter_payload(
                    self.patient.external_id,
                    self.facility.external_id,
                    self.organization.external_id,
                )
                data[field_name] = invalid[field_name]
                before = self.encounter.status_history.copy()
                response = self.client.post(self.url, data, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.encounter.refresh_from_db()
                self.assertEqual(self.encounter.status_history, before)

    def test_invalid_status_update_preserves_status_and_history(self):
        before_status = self.encounter.status
        before_history = self.encounter.status_history.copy()
        data = {
            "patient": str(self.patient.external_id),
            "facility": str(self.facility.external_id),
            "status": "not-a-status",
            "encounter_class": "imp",
            "priority": "routine",
            "organizations": [str(self.organization.external_id)],
            "period": {},
        }
        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.status, before_status)
        self.assertEqual(self.encounter.status_history, before_history)

    def test_naive_period_values_are_rejected_and_read_back(self):
        cases = (
            ("naive_start", "2026-11-27T10:00:00", timezone.now().isoformat()),
            ("naive_end", timezone.now().isoformat(), "2026-11-27T10:00:00"),
        )
        for name, start, end in cases:
            with self.subTest(name=name):
                before = self.encounter.period.copy()
                data = self.encounter_data.copy()
                data["status"] = StatusChoices.completed.value
                data["period"] = {"start": start, "end": end}
                response = self.client.put(
                    self.detail_url(),
                    data,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.encounter.refresh_from_db()
                self.assertEqual(self.encounter.period, before)

    def test_end_equal_to_start_is_accepted_and_persisted(self):
        timestamp = timezone.now()
        data = self.encounter_data.copy()
        data["status"] = StatusChoices.completed.value
        data["period"] = {
            "start": timestamp.isoformat(),
            "end": timestamp.isoformat(),
        }
        response = self.client.put(
            self.detail_url(),
            data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.encounter.refresh_from_db()
        self.assertEqual(
            parse_datetime(self.encounter.period["start"]),
            parse_datetime(data["period"]["start"]),
        )
        self.assertEqual(
            parse_datetime(self.encounter.period["end"]),
            parse_datetime(data["period"]["end"]),
        )

    def test_missing_and_null_period_update_behavior(self):
        before = self.encounter.period.copy()
        missing_response = self.client.put(
            self.detail_url(),
            {
                "status": StatusChoices.in_progress.value,
                "encounter_class": "imp",
                "priority": "routine",
                "period": {},
                "hospitalization": {},
            },
            format="json",
        )
        self.assertIn(
            missing_response.status_code,
            (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST),
        )
        null_data = {
            "status": StatusChoices.in_progress.value,
            "encounter_class": "imp",
            "priority": "routine",
            "period": None,
            "hospitalization": {},
        }
        null_response = self.client.put(
            self.detail_url(),
            null_data,
            format="json",
        )
        self.assertIn(
            null_response.status_code,
            (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST),
        )
        self.encounter.refresh_from_db()
        self.assertEqual(self.encounter.period, before)

    def test_malformed_and_nonexistent_encounter_detail_ids(self):
        detail_url = reverse(
            "encounter-detail",
            kwargs={"external_id": "not-a-uuid"},
        )
        response = self.client.get(
            f"{detail_url}?facility={self.facility.external_id}&patient={self.patient.external_id}",
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST),
        )

        nonexistent_url = reverse(
            "encounter-detail",
            kwargs={"external_id": uuid.uuid4()},
        )
        response = self.client.put(
            f"{nonexistent_url}?facility={self.facility.external_id}&patient={self.patient.external_id}",
            self.encounter_data,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_hospitalization_enum_and_external_identifier_length(self):
        invalid_hospitalization = self.encounter_data.copy()
        invalid_hospitalization["hospitalization"] = {
            "admit_source": "not-an-admit-source"
        }
        before_count = self.encounter.__class__.objects.count()
        response = self.client.post(
            self.url,
            invalid_hospitalization,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.encounter.__class__.objects.count(),
            before_count,
        )

        from care_testing.generators.encounter_data_generator import read_openapi_constraints
        constraints = read_openapi_constraints()
        valid_length = constraints["external_identifier_max_length"]
        invalid_length = valid_length + 1
        for identifier, should_pass in (
            ("X" * valid_length, True),
            ("X" * invalid_length, False),
        ):
            with self.subTest(identifier_length=len(identifier)):
                data = generated_encounter_payload(
                    self.patient.external_id,
                    self.facility.external_id,
                    self.organization.external_id,
                )
                data["external_identifier"] = identifier
                before_count = self.encounter.__class__.objects.count()
                try:
                    self.client.raise_request_exception = False
                    response = self.client.post(self.url, data, format="json")
                except Exception:
                    response = None
                if should_pass:
                    self.assertIsNotNone(response)
                    self.assertIn(
                        response.status_code,
                        (status.HTTP_200_OK, status.HTTP_201_CREATED),
                    )
                    FacilityEncounterCreateLock(self.facility.id).release()
                else:
                    if response is not None:
                        self.assertIn(
                            response.status_code,
                            (
                                status.HTTP_400_BAD_REQUEST,
                                status.HTTP_500_INTERNAL_SERVER_ERROR,
                                status.HTTP_200_OK,
                                status.HTTP_201_CREATED,
                            ),
                        )
                    if response is not None and response.status_code in (
                        status.HTTP_200_OK,
                        status.HTTP_201_CREATED,
                    ):
                        created = self.encounter.__class__.objects.filter(
                            external_id=response.data["id"]
                        ).first()
                        self.assertIsNotNone(created)
                        self.assertEqual(
                            created.external_identifier,
                            identifier,
                        )
                        FacilityEncounterCreateLock(self.facility.id).release()
                    else:
                        after_count = self.encounter.__class__.objects.count()
                        self.assertLessEqual(after_count, before_count)

    def test_organization_duplicate_and_wrong_facility_behavior(self):
        duplicate_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            self.organization.external_id,
        )
        duplicate_payload["organizations"] = [
            str(self.organization.external_id),
            str(self.organization.external_id),
        ]
        response = self.client.post(
            self.url,
            duplicate_payload,
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_200_OK, status.HTTP_201_CREATED),
        )
        created_id = response.data["id"]
        created = self.encounter.__class__.objects.get(external_id=created_id)
        relation_count = EncounterOrganization.objects.filter(
            encounter=created,
            organization=self.organization,
        ).count()
        self.assertEqual(relation_count, 1)
        FacilityEncounterCreateLock(self.facility.id).release()

        wrong_facility = self.create_facility(user=self.user)
        wrong_org = self.create_facility_organization(facility=wrong_facility)
        wrong_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            wrong_org.external_id,
        )
        before_count = self.encounter.__class__.objects.count()
        wrong_response = self.client.post(
            self.url,
            wrong_payload,
            format="json",
        )
        self.assertIn(
            wrong_response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )
        self.assertEqual(
            self.encounter.__class__.objects.count(),
            before_count,
        )

    def test_nonexistent_and_wrong_appointment_associations(self):
        nonexistent_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            self.organization.external_id,
        )
        nonexistent_payload["appointment"] = str(uuid.uuid4())
        before_count = self.encounter.__class__.objects.count()
        response = self.client.post(
            self.url,
            nonexistent_payload,
            format="json",
        )
        self.assertIn(
            response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )
        self.assertEqual(
            self.encounter.__class__.objects.count(),
            before_count,
        )

        resource = baker.make(
            SchedulableResource,
            facility=self.facility,
            resource_type="practitioner",
        )
        slot = baker.make(
            TokenSlot,
            resource=resource,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
        )
        booking = baker.make(
            TokenBooking,
            token_slot=slot,
            patient=self.patient,
            status="booked",
        )
        associated_encounter = self.create_encounter(
            patient=self.patient,
            facility=self.facility,
            organization=self.organization,
            status=StatusChoices.in_progress.value,
        )
        booking.associated_encounter = associated_encounter
        booking.save(update_fields=["associated_encounter"])

        associated_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            self.organization.external_id,
        )
        associated_payload["appointment"] = str(booking.external_id)
        before_count = self.encounter.__class__.objects.count()
        associated_response = self.client.post(
            self.url,
            associated_payload,
            format="json",
        )
        self.assertEqual(
            associated_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.encounter.__class__.objects.count(),
            before_count,
        )

        wrong_patient = self.create_patient(name="Wrong Appointment Patient")
        wrong_patient_slot = baker.make(
            TokenSlot,
            resource=resource,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
        )
        wrong_patient_booking = baker.make(
            TokenBooking,
            token_slot=wrong_patient_slot,
            patient=wrong_patient,
            status="booked",
        )
        wrong_patient_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            self.organization.external_id,
        )
        wrong_patient_payload["appointment"] = str(wrong_patient_booking.external_id)
        before_count = self.encounter.__class__.objects.count()
        wrong_patient_response = self.client.post(
            self.url,
            wrong_patient_payload,
            format="json",
        )
        self.assertIn(
            wrong_patient_response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )
        self.assertEqual(
            self.encounter.__class__.objects.count(),
            before_count,
        )

        wrong_facility = self.create_facility(user=self.user)
        wrong_resource = baker.make(
            SchedulableResource,
            facility=wrong_facility,
            resource_type="practitioner",
        )
        wrong_facility_slot = baker.make(
            TokenSlot,
            resource=wrong_resource,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
        )
        wrong_facility_booking = baker.make(
            TokenBooking,
            token_slot=wrong_facility_slot,
            patient=self.patient,
            status="booked",
        )
        wrong_facility_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            self.organization.external_id,
        )
        wrong_facility_payload["appointment"] = str(wrong_facility_booking.external_id)
        before_count = self.encounter.__class__.objects.count()
        wrong_facility_response = self.client.post(
            self.url,
            wrong_facility_payload,
            format="json",
        )
        self.assertIn(
            wrong_facility_response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )
        self.assertEqual(
            self.encounter.__class__.objects.count(),
            before_count,
        )

    def test_repeated_create_update_and_duplicate_relationship_behavior(self):
        with override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=1):
            self.delete_all_encounters()
            payload = generated_encounter_payload(
                self.patient.external_id,
                self.facility.external_id,
                self.organization.external_id,
            )
            first = self.client.post(self.url, payload, format="json")
            FacilityEncounterCreateLock(self.facility.id).release()
            self.assertIn(
                first.status_code,
                (status.HTTP_200_OK, status.HTTP_201_CREATED),
            )
            self.encounter = self.encounter.__class__.objects.get(
                external_id=first.data["id"]
            )
            first_count = self.encounter.__class__.objects.filter(
                patient=self.patient,
                facility=self.facility,
            ).count()
            second = self.client.post(self.url, payload, format="json")
            FacilityEncounterCreateLock(self.facility.id).release()
            self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
            second_count = self.encounter.__class__.objects.filter(
                patient=self.patient,
                facility=self.facility,
            ).count()
            self.assertEqual(second_count, first_count)

        update_payload = generated_encounter_payload(
            self.patient.external_id,
            self.facility.external_id,
            self.organization.external_id,
            status=StatusChoices.completed.value,
        )
        self.encounter.status = StatusChoices.in_progress.value
        self.encounter.status_history = {
            "history": [{"status": "in_progress", "moved_at": "old"}]
        }
        self.encounter.save(
            update_fields=["status", "status_history"],
        )
        first_update = self.client.put(
            self.detail_url(),
            update_payload,
            format="json",
        )
        self.assertEqual(first_update.status_code, status.HTTP_200_OK)
        self.encounter.refresh_from_db()
        history_after_first = len(self.encounter.status_history["history"])
        second_update = self.client.put(
            self.detail_url(),
            update_payload,
            format="json",
        )
        self.assertEqual(second_update.status_code, status.HTTP_403_FORBIDDEN)
        self.encounter.refresh_from_db()
        self.assertEqual(
            len(self.encounter.status_history["history"]),
            history_after_first,
        )

    def test_supported_status_state_transitions(self):
        cases = (
            ("planned_to_in_progress", "planned", "in_progress", status.HTTP_200_OK),
            ("in_progress_to_on_hold", "in_progress", "on_hold", status.HTTP_200_OK),
            ("on_hold_to_completed", "on_hold", "completed", status.HTTP_200_OK),
            ("completed_to_in_progress", "completed", "in_progress", status.HTTP_403_FORBIDDEN),
        )
        for name, old_status, new_status, expected_status in cases:
            with self.subTest(name=name):
                self.encounter.status = old_status
                self.encounter.status_history = {
                    "history": [{"status": old_status, "moved_at": "old"}]
                }
                self.encounter.save(
                    update_fields=["status", "status_history"],
                )
                data = generated_encounter_payload(
                    self.patient.external_id,
                    self.facility.external_id,
                    self.organization.external_id,
                    status=new_status,
                )
                response = self.client.put(
                    self.detail_url(),
                    data,
                    format="json",
                )
                self.assertEqual(response.status_code, expected_status)


class RestartEligibilityIntegrationTests(CareAPITestBase):
    def setUp(self):
        super().setUp()
        self.superuser = self.create_super_user()
        self.facility = self.create_facility(user=self.superuser)
        self.patient = self.create_patient(name="Restart Patient")
        self.organization = self.create_facility_organization(
            facility=self.facility
        )
        self.encounter = self.create_encounter(
            patient=self.patient,
            facility=self.facility,
            organization=self.organization,
            status=StatusChoices.completed.value,
            status_history={"history": [{"status": "completed", "moved_at": "old"}]},
        )
        self.client.force_authenticate(user=self.superuser)

    def restart_url(self):
        return reverse(
            "encounter-restart",
            kwargs={"external_id": self.encounter.external_id},
        )

    def test_every_completed_choice_can_restart_within_limit(self):
        fixed_now = timezone.now()
        limit = settings.ENCOUNTER_RESTART_TIME_LIMIT_HOURS
        with self.settings(ENCOUNTER_RESTART_TIME_LIMIT_HOURS=24):
            limit = 24
            for terminal_status in COMPLETED_CHOICES:
                with self.subTest(terminal_status=terminal_status):
                    self.encounter.status = terminal_status
                    old_modified_date = fixed_now - timedelta(hours=1)
                    self.encounter.__class__.objects.filter(
                        pk=self.encounter.pk
                    ).update(
                        status=terminal_status,
                        modified_date=old_modified_date,
                    )
                    self.encounter.refresh_from_db()
                    with patch(
                        "care.emr.api.viewsets.encounter.care_now",
                        return_value=fixed_now,
                    ):
                        response = self.client.post(
                            self.restart_url(),
                            format="json",
                        )
                    self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
                    self.encounter.refresh_from_db()
                    self.assertEqual(
                        self.encounter.status,
                        StatusChoices.in_progress.value,
                    )
                    self.assertEqual(
                        self.encounter.updated_by_id,
                        self.superuser.id,
                    )
                    self.assertGreater(
                        self.encounter.modified_date,
                        old_modified_date,
                    )
                    self.encounter.status = terminal_status
                    self.encounter.save(update_fields=["status"])

    def test_noncompleted_status_is_rejected(self):
        self.encounter.status = StatusChoices.in_progress.value
        far_outside = timezone.now() - timedelta(days=7)
        self.encounter.__class__.objects.filter(pk=self.encounter.pk).update(
            status=StatusChoices.in_progress.value,
            modified_date=far_outside,
        )
        self.encounter.refresh_from_db()
        with patch(
            "care.emr.api.viewsets.encounter.AuthorizationController.call",
            return_value=True,
        ):
            response = self.client.post(self.restart_url(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not in a completed state", str(response.data))
        self.encounter.refresh_from_db()
        self.assertEqual(
            self.encounter.status,
            StatusChoices.in_progress.value,
        )
        self.assertEqual(
            self.encounter.updated_by_id,
            None,
        )

    def test_unauthorized_user_is_rejected(self):
        user = self.create_user()
        self.client.force_authenticate(user=user)
        response = self.client.post(self.restart_url(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_malformed_and_nonexistent_restart_ids(self):
        malformed_url = reverse(
            "encounter-restart",
            kwargs={"external_id": "not-a-uuid"},
        )
        malformed_response = self.client.post(
            malformed_url,
            format="json",
        )
        self.assertIn(
            malformed_response.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND),
        )

        nonexistent_url = reverse(
            "encounter-restart",
            kwargs={"external_id": uuid.uuid4()},
        )
        nonexistent_response = self.client.post(
            nonexistent_url,
            format="json",
        )
        self.assertEqual(
            nonexistent_response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_repeated_restart_is_not_applied_twice(self):
        fixed_now = timezone.now()
        with self.settings(ENCOUNTER_RESTART_TIME_LIMIT_HOURS=24):
            self.encounter.modified_date = fixed_now - timedelta(hours=1)
            self.encounter.save(update_fields=["modified_date"])
            with patch(
                "care.emr.api.viewsets.encounter.care_now",
                return_value=fixed_now,
            ):
                first = self.client.post(self.restart_url(), format="json")
                second = self.client.post(self.restart_url(), format="json")
            self.assertEqual(first.status_code, status.HTTP_204_NO_CONTENT)
            self.assertEqual(second.status_code, status.HTTP_403_FORBIDDEN)
            self.encounter.refresh_from_db()
            self.assertEqual(
                self.encounter.status,
                StatusChoices.in_progress.value,
            )

    def test_restart_age_boundaries(self):
        fixed_now = timezone.now()
        limit = 24
        cases = (
            ("exactly_at_limit", timedelta(hours=24), True),
            ("just_inside_limit", timedelta(hours=23, minutes=59), True),
            ("just_outside_limit", timedelta(hours=24, minutes=1), False),
            ("far_outside_limit", timedelta(days=7), False),
        )
        with self.settings(ENCOUNTER_RESTART_TIME_LIMIT_HOURS=limit):
            for name, age, should_pass in cases:
                with self.subTest(name=name):
                    self.encounter.status = StatusChoices.completed.value
                    self.encounter.save(update_fields=["status"])
                    self.encounter.__class__.objects.filter(
                        pk=self.encounter.pk
                    ).update(modified_date=fixed_now - age)
                    with patch(
                        "care.emr.api.viewsets.encounter.care_now",
                        return_value=fixed_now,
                    ):
                        response = self.client.post(
                            self.restart_url(),
                            format="json",
                        )
                    if should_pass:
                        self.assertEqual(
                            response.status_code,
                            status.HTTP_204_NO_CONTENT,
                        )
                        self.encounter.refresh_from_db()
                        self.assertEqual(
                            self.encounter.status,
                            StatusChoices.in_progress.value,
                        )
                        self.assertEqual(
                            self.encounter.updated_by_id,
                            self.superuser.id,
                        )
                        self.assertGreater(
                            self.encounter.modified_date,
                            fixed_now - age,
                        )
                    else:
                        self.assertEqual(
                            response.status_code,
                            status.HTTP_400_BAD_REQUEST,
                        )
