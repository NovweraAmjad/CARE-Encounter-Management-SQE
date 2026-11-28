"""Section 5 - controlled failure-and-recovery test (REC-ENC-001).

State-changing operation: POST /api/v1/encounter/ (create an encounter linked to
an appointment booking).

Dependency made unavailable: Redis, which backs CARE's FacilityEncounterCreateLock.
In EncounterViewSet.perform_create the lock is acquired AFTER the Encounter row,
its EncounterOrganization rows and the booking association have been written,
but BEFORE the transaction commits and before the patient's facility identifiers
are created. A test double makes the lock raise redis.ConnectionError at exactly
that point ("dependency unavailable before the write completes").

The test verifies:
  1. the request fails (HTTP 500, the client is told the request did not succeed);
  2. the persisted state is unchanged: no encounter, no organization link, the
     booking is still free, no identifier was created (atomic rollback);
  3. after the dependency is restored, retrying the SAME request succeeds;
  4. the final state has exactly one encounter, one organization link, the
     booking linked to that encounter and one identifier: no duplicates;
  5. a further duplicate retry is rejected and still leaves exactly one encounter.
"""
from datetime import timedelta
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from model_bakery import baker
from redis.exceptions import ConnectionError as RedisConnectionError
from rest_framework import status

from care.emr.locks.billing import FacilityEncounterCreateLock
from care.emr.models.encounter import Encounter, EncounterOrganization
from care.emr.models.scheduling.booking import TokenBooking, TokenSlot
from care.emr.models.scheduling.schedule import SchedulableResource
from care.emr.resources.encounter.constants import StatusChoices
from care.security.permissions.encounter import EncounterPermissions
from care.security.permissions.patient import PatientPermissions
from care.utils.tests.base import CareAPITestBase


class EncounterCreateRecoveryTests(CareAPITestBase):
    def setUp(self):
        super().setUp()
        from care.emr.models import Availability, Schedule
        from care.emr.models.patient import PatientIdentifierConfig

        self.facility = self.create_facility(user=self.create_super_user())
        self.patient = self.create_patient(name="Recovery Test Patient")
        self.organization = self.create_facility_organization(facility=self.facility)
        self.user = self.create_user()
        role = self.create_role_with_permissions(
            [
                EncounterPermissions.can_create_encounter.name,
                EncounterPermissions.can_read_encounter.name,
                PatientPermissions.can_list_patients.name,
            ]
        )
        self.attach_role_facility_organization_user(self.organization, self.user, role)
        self.client.force_authenticate(user=self.user)

        self.identifier_config = baker.make(
            PatientIdentifierConfig,
            facility=self.facility,
            status="active",
            config={"default_value": "patient_count + 500", "display": "Recovery MRN"},
        )
        resource = SchedulableResource.objects.create(
            facility=self.facility, resource_type="practitioner", user=self.user
        )
        schedule = Schedule.objects.create(
            resource=resource,
            name="Recovery Schedule",
            valid_from=timezone.now() - timedelta(days=1),
            valid_to=timezone.now() + timedelta(days=1),
            is_public=True,
        )
        availability = Availability.objects.create(
            schedule=schedule,
            name="Recovery Availability",
            slot_type="appointment",
            slot_size_in_minutes=60,
            tokens_per_slot=10,
            create_tokens=False,
            reason="",
            availability=[
                {"day_of_week": d, "start_time": "00:00:00", "end_time": "23:59:00"}
                for d in range(7)
            ],
        )
        slot = TokenSlot.objects.create(
            resource=resource,
            availability=availability,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
            allocated=1,
        )
        self.booking = TokenBooking.objects.create(
            token_slot=slot, patient=self.patient, booked_by=self.user, status="booked"
        )
        self.url = reverse("encounter-list")
        self.payload = {
            "patient": str(self.patient.external_id),
            "facility": str(self.facility.external_id),
            "status": StatusChoices.in_progress.value,
            "encounter_class": "amb",
            "priority": "routine",
            "organizations": [str(self.organization.external_id)],
            "period": {"start": timezone.now().isoformat()},
            "appointment": str(self.booking.external_id),
        }

    # -------------------------------------------------------------- helpers
    def snapshot(self):
        """Everything the create operation writes, read back from the database."""
        self.booking.refresh_from_db()
        encounters = Encounter.objects.filter(patient=self.patient, facility=self.facility)
        return {
            "encounters": encounters.count(),
            "organization_links": EncounterOrganization.objects.filter(
                encounter__in=encounters
            ).count(),
            "booking_encounter": self.booking.associated_encounter_id,
            "identifiers": self.patient.patientidentifier_set.filter(
                config=self.identifier_config
            ).count(),
        }

    def post(self):
        response = self.client.post(self.url, self.payload, format="json")
        FacilityEncounterCreateLock(self.facility.id).release()
        return response

    # ----------------------------------------------------------------- test
    def test_redis_unavailable_mid_create_then_recover_without_duplicates(self):
        before = self.snapshot()
        self.assertEqual(
            before,
            {"encounters": 0, "organization_links": 0, "booking_encounter": None, "identifiers": 0},
        )

        # 1-2. Dependency unavailable before the write completes.
        self.client.raise_request_exception = False  # observe the HTTP response
        with patch.object(
            FacilityEncounterCreateLock,
            "acquire",
            side_effect=RedisConnectionError("Redis unavailable (simulated)"),
        ) as lock_acquire:
            failed = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(lock_acquire.call_count, 1)  # the failure happened mid-write
        self.assertEqual(failed.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(self.snapshot(), before)  # nothing persisted, nothing half-written

        # 3. Dependency restored (patch removed); retry the identical request.
        self.client.raise_request_exception = True
        retried = self.post()
        self.assertIn(retried.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

        # 4. Exactly one of everything, linked together.
        after = self.snapshot()
        created = Encounter.objects.get(patient=self.patient, facility=self.facility)
        self.assertEqual(str(created.external_id), retried.data["id"])
        self.assertEqual(
            after,
            {"encounters": 1, "organization_links": 1, "booking_encounter": created.id, "identifiers": 1},
        )
        self.assertEqual(created.status, StatusChoices.in_progress.value)
        self.assertEqual(len(created.status_history["history"]), 1)

        # 5. A duplicate retry (e.g. the client re-sends after a timeout) is
        #    rejected and does not create a second encounter.
        duplicate = self.post()
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.snapshot(), after)
