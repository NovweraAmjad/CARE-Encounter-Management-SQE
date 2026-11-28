"""API-ENC-033..041: integration tests added from the mutation survivor analysis.

Each test names the surviving mutants (mutmut ids, see
testing/evidence/mutation-analysis.md) it was written to kill. All data is
synthetic and created inside the test transaction.
"""
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from model_bakery import baker
from rest_framework import status

from care.emr.locks.billing import FacilityEncounterCreateLock
from care.emr.models.encounter import Encounter
from care.emr.models.scheduling.booking import TokenBooking, TokenSlot
from care.emr.models.scheduling.schedule import SchedulableResource
from care.emr.resources.encounter.constants import StatusChoices
from care.security.permissions.encounter import EncounterPermissions
from care.security.permissions.patient import PatientPermissions
from care.utils.tests.base import CareAPITestBase


def error_messages(data):
    """Flatten a DRF/CARE error body into its message strings."""
    if isinstance(data, str):
        return [data]
    if isinstance(data, list):
        return [m for item in data for m in error_messages(item)]
    if isinstance(data, dict):
        return [m for value in data.values() for m in error_messages(value)]
    return [str(data)]


class EncounterMutationGapTests(CareAPITestBase):
    def setUp(self):
        super().setUp()
        from care.emr.models.patient import PatientIdentifierConfig

        self.facility = self.create_facility(user=self.create_super_user())
        self.patient = self.create_patient(name="Mutation Gap Patient")
        self.organization = self.create_facility_organization(facility=self.facility)
        self.user = self.create_user()
        role = self.create_role_with_permissions(
            [
                EncounterPermissions.can_create_encounter.name,
                EncounterPermissions.can_read_encounter.name,
                EncounterPermissions.can_list_encounter.name,
                EncounterPermissions.can_write_encounter.name,
                PatientPermissions.can_list_patients.name,
            ]
        )
        self.attach_role_facility_organization_user(self.organization, self.user, role)
        self.client.force_authenticate(user=self.user)
        self.identifier_config = baker.make(
            PatientIdentifierConfig,
            facility=self.facility,
            status="active",
            config={"default_value": "patient_count + 100", "display": "Facility MRN"},
        )
        self.list_url = reverse("encounter-list")

    # ------------------------------------------------------------ helpers
    def payload(self, **overrides):
        data = {
            "patient": str(self.patient.external_id),
            "facility": str(self.facility.external_id),
            "status": StatusChoices.in_progress.value,
            "encounter_class": "amb",
            "priority": "routine",
            "organizations": [str(self.organization.external_id)],
            "period": {"start": timezone.now().isoformat()},
        }
        data.update(overrides)
        return data

    def create_via_api(self, **overrides):
        response = self.client.post(self.list_url, self.payload(**overrides), format="json")
        FacilityEncounterCreateLock(self.facility.id).release()
        return response

    def detail_url(self, encounter):
        return reverse("encounter-detail", kwargs={"external_id": encounter.external_id})

    def open_encounter(self, patient=None):
        return self.create_encounter(
            patient=patient or self.patient,
            facility=self.facility,
            organization=self.organization,
            status=StatusChoices.in_progress.value,
            status_history={
                "history": [{"status": StatusChoices.in_progress.value, "moved_at": "fixture"}]
            },
        )

    def booking(self, resource):
        """Booking built the way CARE's own test_booking_api.py builds one
        (resource -> schedule -> availability -> slot -> booking)."""
        from care.emr.models import Availability, Schedule

        schedule = Schedule.objects.create(
            resource=resource,
            name="Mutation Gap Schedule",
            valid_from=timezone.now() - timedelta(days=1),
            valid_to=timezone.now() + timedelta(days=1),
            is_public=True,
        )
        availability = Availability.objects.create(
            schedule=schedule,
            name="Mutation Gap Availability",
            slot_type="appointment",
            slot_size_in_minutes=60,
            tokens_per_slot=10,
            create_tokens=False,
            reason="",
            availability=[{"day_of_week": d, "start_time": "00:00:00", "end_time": "23:59:00"} for d in range(7)],
        )
        slot = TokenSlot.objects.create(
            resource=resource,
            availability=availability,
            start_datetime=timezone.now(),
            end_datetime=timezone.now() + timedelta(hours=1),
            allocated=1,
        )
        return TokenBooking.objects.create(
            token_slot=slot, patient=self.patient, booked_by=self.user, status="booked"
        )

    # -------------------------------------------------------------- tests
    @override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=2)
    def test_active_limit_counts_only_this_patient(self):
        # API-ENC-033 kills validate_data_5 (count query without the patient filter).
        other = self.create_patient(name="Other Patient At Limit")
        self.open_encounter(other)
        self.open_encounter(other)
        response = self.create_via_api()
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

    def test_create_side_effects_history_and_facility_identifier(self):
        # API-ENC-034 kills create-spec 40 (moved_at), perform_create 41/42/45
        # (facility default identifiers) and retrieve-spec 8/10.
        before = timezone.now()
        response = self.create_via_api()
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        encounter = Encounter.objects.get(external_id=response.data["id"])
        moved_at = parse_datetime(encounter.status_history["history"][0]["moved_at"])
        self.assertIsNotNone(moved_at)
        self.assertGreaterEqual(moved_at, before - timedelta(seconds=5))
        values = list(
            self.patient.patientidentifier_set.filter(config=self.identifier_config).values_list(
                "value", flat=True
            )
        )
        self.assertIn("100", values)  # produced by the facility default rule
        self.patient.refresh_from_db()
        self.assertIn(str(self.facility.id), self.patient.facility_identifiers)
        detail = self.client.get(self.detail_url(encounter))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertIn(
            "100", [x["value"] for x in detail.data["patient"]["facility_identifiers"]]
        )

    def test_update_keeps_discharge_advice_and_timestamps_history(self):
        # API-ENC-035 kills update-spec 11 (moved_at) and 12 (advice wiped on update).
        encounter = self.open_encounter()
        before = timezone.now()
        response = self.client.put(
            self.detail_url(encounter),
            {
                "status": StatusChoices.on_hold.value,
                "period": {"start": timezone.now().isoformat()},
                "hospitalization": {},
                "priority": "routine",
                "discharge_summary_advice": "Rest and review in 7 days",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        encounter.refresh_from_db()
        self.assertEqual(encounter.discharge_summary_advice, "Rest and review in 7 days")
        last = encounter.status_history["history"][-1]
        self.assertEqual(last["status"], StatusChoices.on_hold.value)
        self.assertGreaterEqual(parse_datetime(last["moved_at"]), before - timedelta(seconds=5))

    def test_create_in_other_facility_is_denied_with_message(self):
        # API-ENC-036 kills authorize_create 1/9 (permission checked without the
        # facility) and 15-18 (message).
        other_facility = self.create_facility(user=self.create_super_user())
        response = self.client.post(
            self.list_url,
            self.payload(facility=str(other_facility.external_id), organizations=[]),
            format="json",
        )
        FacilityEncounterCreateLock(other_facility.id).release()
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            str(response.data["detail"]), "You do not have permission to create encounter"
        )

    def test_update_without_write_permission_is_denied_with_message(self):
        # API-ENC-037 kills authorize_update 10-13 (message).
        encounter = self.open_encounter()
        reader = self.create_user()
        self.attach_role_facility_organization_user(
            self.organization,
            reader,
            self.create_role_with_permissions([EncounterPermissions.can_read_encounter.name]),
        )
        self.client.force_authenticate(user=reader)
        response = self.client.put(
            self.detail_url(encounter),
            {
                "status": StatusChoices.completed.value,
                "period": {"start": timezone.now().isoformat()},
                "hospitalization": {},
                "priority": "routine",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            str(response.data["detail"]), "You do not have permission to update encounter"
        )
        encounter.refresh_from_db()
        self.assertEqual(encounter.status, StatusChoices.in_progress.value)

    def test_list_access_paths(self):
        # API-ENC-038 kills get_queryset 31-58 (?patient= path), 73 (facility
        # lookup without its id) and 87-92 (no filter -> 403 with message).
        mine = self.open_encounter()
        other_patient = self.create_patient(name="Other List Patient")
        theirs = self.open_encounter(other_patient)
        self.create_facility(user=self.create_super_user())  # a second facility exists

        by_patient = self.client.get(self.list_url, {"patient": str(self.patient.external_id)})
        self.assertEqual(by_patient.status_code, status.HTTP_200_OK)
        self.assertEqual({r["id"] for r in by_patient.data["results"]}, {str(mine.external_id)})

        by_facility = self.client.get(self.list_url, {"facility": str(self.facility.external_id)})
        self.assertEqual(by_facility.status_code, status.HTTP_200_OK)
        self.assertEqual(
            {r["id"] for r in by_facility.data["results"]},
            {str(mine.external_id), str(theirs.external_id)},
        )

        no_filter = self.client.get(self.list_url)
        self.assertEqual(no_filter.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(no_filter.data["detail"]), "Cannot access encounters")

        self.client.force_authenticate(user=self.create_user())
        denied = self.client.get(self.list_url, {"patient": str(self.patient.external_id)})
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(str(denied.data["detail"]), "User cannot access patient")
        missing = self.client.get(self.list_url, {"patient": str(uuid.uuid4())})
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_appointment_is_linked_to_the_requested_booking(self):
        # API-ENC-039 kills create-spec 25 (booking looked up without its id),
        # perform_create 26/27/29-34 (association persisted) and 22-25 (message).
        resource = SchedulableResource.objects.create(
            facility=self.facility, resource_type="practitioner", user=self.user
        )
        first, second = self.booking(resource), self.booking(resource)
        response = self.create_via_api(appointment=str(second.external_id))
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        second.refresh_from_db()
        first.refresh_from_db()
        self.assertEqual(str(second.associated_encounter.external_id), response.data["id"])
        self.assertEqual(second.updated_by_id, self.user.id)
        self.assertIsNone(first.associated_encounter_id)
        detail = self.client.get(self.detail_url(second.associated_encounter))
        self.assertEqual(detail.data["appointment"]["id"], str(second.external_id))

        again = self.create_via_api(appointment=str(second.external_id))
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Encounter already has an associated booking", error_messages(again.data))

    def test_create_lock_failure_returns_message(self):
        # API-ENC-040 kills perform_create 37-40 (lock-failure message).
        from care.utils.lock import ObjectLocked

        with patch.object(FacilityEncounterCreateLock, "acquire", side_effect=ObjectLocked()):
            response = self.client.post(self.list_url, self.payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn(
            "Encounter creation failed, try again after a while", error_messages(response.data)
        )

    def test_detail_payload_read_back(self):
        # API-ENC-041 kills the retrieve-spec survivors (detail payload fields were
        # never asserted one by one).
        from care.emr.models.location import FacilityLocation, FacilityLocationEncounter
        from care.emr.models.tag_config import TagConfig

        resource = SchedulableResource.objects.create(
            facility=self.facility, resource_type="practitioner", user=self.user
        )
        appointment = self.booking(resource)
        member = self.create_user()
        location = baker.make(FacilityLocation, facility=self.facility, name="Detail Ward")
        tag = baker.make(TagConfig, facility=self.facility, status="active", display="Detail tag")
        full = self.open_encounter()
        full.appointment = appointment
        full.current_location = location
        full.tags = [tag.id]
        full.care_team = [{"user_id": member.id, "role": {"code": "nur", "display": "Nurse"}}]
        full.save()
        history = baker.make(
            FacilityLocationEncounter,
            encounter=full,
            location=location,
            status="active",
            start_datetime=timezone.now(),
        )
        bare = self.open_encounter()

        a = self.client.get(self.detail_url(full)).data
        b = self.client.get(self.detail_url(bare)).data
        self.assertEqual(a["patient"]["id"], str(self.patient.external_id))
        self.assertEqual(a["facility"]["id"], str(self.facility.external_id))
        self.assertEqual([t["id"] for t in a["tags"]], [str(tag.external_id)])
        self.assertEqual(a["appointment"]["id"], str(appointment.external_id))
        self.assertEqual(
            [o["id"] for o in a["organizations"]], [str(self.organization.external_id)]
        )
        self.assertEqual(len(a["location_history"]), 1)
        self.assertEqual(
            str(dict(a["location_history"][0])["id"]), str(history.external_id)
        )
        self.assertEqual(a["current_location"]["id"], str(location.external_id))
        self.assertEqual(len(a["care_team"]), 1)
        self.assertEqual(a["care_team"][0]["member"]["username"], member.username)
        self.assertEqual(a["care_team"][0]["role"], {"code": "nur", "display": "Nurse"})
        self.assertIn("current_location", b)
        self.assertIsNone(b["current_location"])
        self.assertEqual(b["care_team"], [])
        self.assertEqual(b["tags"], [])
        self.assertEqual(b["appointment"], {})
        self.assertEqual(b["location_history"], [])

    def test_create_without_departments_syncs_facility_organization(self):
        # API-ENC-042: creating without departments still scopes the encounter to
        # the facility's default organization. Written for perform_create_21; that
        # mutant still passes this test (verified with MUTANT_UNDER_TEST), proving
        # the cache is also synced elsewhere, so mutant 21 is EQUIVALENT.
        response = self.create_via_api(organizations=[])
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        encounter = Encounter.objects.get(external_id=response.data["id"])
        self.facility.refresh_from_db()
        self.assertEqual(
            encounter.facility_organization_cache,
            [self.facility.default_internal_organization_id],
        )
