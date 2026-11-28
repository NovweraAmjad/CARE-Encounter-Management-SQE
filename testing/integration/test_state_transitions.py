"""API-ENC-043/044: full state-transition coverage of the encounter status (BR-ENC-03).

State model as IMPLEMENTED (care/emr/resources/encounter/constants.py and
EncounterViewSet.authorize_update -> can_update_encounter_obj):

  open states   O = planned, in_progress, on_hold, discharged, unknown
  closed states T = completed, cancelled, discontinued, entered_in_error
                    (COMPLETED_CHOICES: a closed encounter cannot be updated)

  allowed : every open state -> every other status via PUT  (5 x 8 = 40)
            every closed state -> in_progress via POST .../restart/
            (covered by RestartEligibilityIntegrationTests)
  disallowed (at least one from EACH state):
            closed state -> any status via PUT          -> 403, unchanged
            open state   -> an undefined status value   -> 400, unchanged

After every request the stored status and status_history are read back.
"""
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from care.emr.resources.encounter.constants import COMPLETED_CHOICES, StatusChoices
from care.security.permissions.encounter import EncounterPermissions
from care.utils.tests.base import CareAPITestBase

ALL_STATES = [s.value for s in StatusChoices]
CLOSED_STATES = list(COMPLETED_CHOICES)
OPEN_STATES = [s for s in ALL_STATES if s not in CLOSED_STATES]


class EncounterStateTransitionTests(CareAPITestBase):
    def setUp(self):
        super().setUp()
        self.facility = self.create_facility(user=self.create_super_user())
        self.patient = self.create_patient(name="State Transition Patient")
        self.organization = self.create_facility_organization(facility=self.facility)
        self.user = self.create_user()
        role = self.create_role_with_permissions(
            [
                EncounterPermissions.can_read_encounter.name,
                EncounterPermissions.can_write_encounter.name,
            ]
        )
        self.attach_role_facility_organization_user(self.organization, self.user, role)
        self.client.force_authenticate(user=self.user)

    def encounter_in(self, state):
        return self.create_encounter(
            patient=self.patient,
            facility=self.facility,
            organization=self.organization,
            status=state,
            status_history={"history": [{"status": state, "moved_at": "fixture"}]},
        )

    def put_status(self, encounter, new_status):
        return self.client.put(
            reverse("encounter-detail", kwargs={"external_id": encounter.external_id}),
            {
                "status": new_status,
                "period": {"start": timezone.now().isoformat()},
                "hospitalization": {},
                "priority": "routine",
            },
            format="json",
        )

    def test_state_model_matches_source(self):
        self.assertEqual(len(ALL_STATES), 9)
        self.assertEqual(sorted(OPEN_STATES), sorted(["planned", "in_progress", "on_hold", "discharged", "unknown"]))
        self.assertEqual(sorted(CLOSED_STATES), sorted(["completed", "cancelled", "discontinued", "entered_in_error"]))

    def test_every_allowed_transition_from_each_open_state(self):
        # API-ENC-043: 5 open states x 8 other statuses = 40 allowed transitions.
        executed = 0
        for source in OPEN_STATES:
            for target in ALL_STATES:
                if target == source:
                    continue
                with self.subTest(transition=f"{source}->{target}"):
                    encounter = self.encounter_in(source)
                    response = self.put_status(encounter, target)
                    self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
                    encounter.refresh_from_db()
                    self.assertEqual(encounter.status, target)
                    history = encounter.status_history["history"]
                    self.assertEqual([h["status"] for h in history], [source, target])
                    executed += 1
        self.assertEqual(executed, 40)

    def test_a_disallowed_transition_from_every_state(self):
        # API-ENC-044: one disallowed change from each of the 9 states.
        for source in CLOSED_STATES:
            with self.subTest(source=source, rule="closed encounters cannot be updated"):
                encounter = self.encounter_in(source)
                response = self.put_status(encounter, StatusChoices.in_progress.value)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                encounter.refresh_from_db()
                self.assertEqual(encounter.status, source)
                self.assertEqual(len(encounter.status_history["history"]), 1)
        for source in OPEN_STATES:
            with self.subTest(source=source, rule="undefined target status"):
                encounter = self.encounter_in(source)
                response = self.put_status(encounter, "archived")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                encounter.refresh_from_db()
                self.assertEqual(encounter.status, source)
                self.assertEqual(len(encounter.status_history["history"]), 1)
