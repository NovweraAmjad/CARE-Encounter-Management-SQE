"""API-ENC-045: every VALID equivalence class produced by the OpenAPI generator.

The generator (testing/generators/encounter_data_generator.py::generate_cases)
reads testing/openapi/encounter-openapi.yaml and lists each enum value as its own
valid class. Each class is exercised in its own sub-test, changing ONE input from
the generated baseline payload, and the created record is read back.
(Invalid classes - one invalid value per test - are API-ENC-020/021/014.)
"""
from django.test import override_settings
from django.urls import reverse
from rest_framework import status

from care.emr.locks.billing import FacilityEncounterCreateLock
from care.emr.models.encounter import Encounter
from care.security.permissions.encounter import EncounterPermissions
from care.utils.tests.base import CareAPITestBase
from care_testing.generators.encounter_data_generator import (
    generate_cases,
    generated_encounter_payload,
)


@override_settings(MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY=1000)
class GeneratedValidPartitionTests(CareAPITestBase):
    def setUp(self):
        super().setUp()
        self.facility = self.create_facility(user=self.create_super_user())
        self.patient = self.create_patient(name="Partition Patient")
        self.organization = self.create_facility_organization(facility=self.facility)
        self.user = self.create_user()
        role = self.create_role_with_permissions(
            [
                EncounterPermissions.can_create_encounter.name,
                EncounterPermissions.can_read_encounter.name,
            ]
        )
        self.attach_role_facility_organization_user(self.organization, self.user, role)
        self.client.force_authenticate(user=self.user)
        self.classes = generate_cases()["equivalence_classes"]

    def create_with(self, field, value):
        payload = generated_encounter_payload(
            self.patient.external_id, self.facility.external_id, self.organization.external_id
        )
        payload[field] = value  # change exactly one input
        response = self.client.post(reverse("encounter-list"), payload, format="json")
        FacilityEncounterCreateLock(self.facility.id).release()
        return response

    def test_every_generated_valid_class_is_accepted_and_persisted(self):
        executed = 0
        for field in ("status", "encounter_class", "priority"):
            for value in self.classes[field]["valid"]:
                with self.subTest(field=field, value=value):
                    response = self.create_with(field, value)
                    self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                    stored = Encounter.objects.get(external_id=response.data["id"])
                    self.assertEqual(getattr(stored, field), value)
                    executed += 1
        # 9 statuses + 6 classes + 13 priorities from the spec
        self.assertEqual(executed, 28)
