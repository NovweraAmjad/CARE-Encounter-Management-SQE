from django.test import SimpleTestCase

from care_testing.generators.encounter_data_generator import (
    generated_encounter_payload,
    generated_invalid_values,
    read_openapi_constraints,
    regenerated_constraints,
)


class EncounterGeneratorTests(SimpleTestCase):
    def test_generated_payload_is_deterministic_and_openapi_aligned(self):
        constraints = read_openapi_constraints()
        first = generated_encounter_payload(
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
            status="in_progress",
        )
        second = generated_encounter_payload(
            "11111111-1111-4111-8111-111111111111",
            "22222222-2222-4222-8222-222222222222",
            "33333333-3333-4333-8333-333333333333",
            status="in_progress",
        )
        self.assertEqual(first, second)
        self.assertIn(first["status"], constraints["statuses"])
        self.assertIn(first["encounter_class"], constraints["classes"])
        self.assertIn(first["priority"], constraints["priorities"])

    def test_generated_invalid_values_are_consumable(self):
        invalid = generated_invalid_values()
        constraints = read_openapi_constraints()
        self.assertNotIn(invalid["status"], constraints["statuses"])
        self.assertNotIn(invalid["encounter_class"], constraints["classes"])
        self.assertNotIn(invalid["priority"], constraints["priorities"])
        self.assertEqual(
            len(invalid["external_identifier"]),
            constraints["external_identifier_max_length"] + 1,
        )

    def test_two_constraint_regeneration_is_deterministic(self):
        first = regenerated_constraints()
        second = regenerated_constraints()
        self.assertEqual(first, second)
        self.assertEqual(first["active_limit_values"]["below"], 2)
        self.assertEqual(first["active_limit_values"]["equal"], 3)
        self.assertEqual(first["active_limit_values"]["above"], 4)
        self.assertEqual(first["external_identifier_lengths"]["at_limit"], 12)
        self.assertEqual(first["external_identifier_lengths"]["above_limit"], 13)
