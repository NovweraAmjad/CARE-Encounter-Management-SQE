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

    def test_generated_cases_have_ep_classes_and_three_point_bva(self):
        # GEN-004: every enum value is a valid class; one invalid value per class;
        # 3-point BVA (below/at/above) for both limits read from the spec.
        from care_testing.generators.encounter_data_generator import generate_cases

        cases = generate_cases()
        c = cases["constraints"]
        self.assertEqual(cases["equivalence_classes"]["status"]["valid"], c["statuses"])
        for field, classes in cases["equivalence_classes"].items():
            self.assertTrue(classes["valid"], field)
            self.assertTrue(classes["invalid"], field)
        bva = cases["boundary_values"]
        limit = c["active_encounter_limit"]
        self.assertEqual(
            [bva["active_encounters_before_create"][k] for k in ("below", "at", "above")],
            [limit - 1, limit, limit + 1],
        )
        self.assertEqual(
            [bva["external_identifier_length"][k] for k in ("below", "at", "above")],
            [99, 100, 101],
        )

    def test_updated_spec_changes_exactly_two_constraints(self):
        # GEN-005: the regenerated spec (encounter-openapi.v2.yaml) differs from the
        # original only in the two constraints, and the BVA values follow it.
        from care_testing.generators.encounter_data_generator import (
            load_changed_openapi,
            load_openapi,
        )

        evidence = regenerated_constraints()
        before, after = evidence["original"], evidence["changed"]
        changed_keys = sorted(k for k in before if before[k] != after[k])
        self.assertEqual(changed_keys, ["active_encounter_limit", "external_identifier_max_length"])
        self.assertEqual((before["active_encounter_limit"], after["active_encounter_limit"]), (5, 3))
        self.assertEqual(
            (before["external_identifier_max_length"], after["external_identifier_max_length"]), (100, 12)
        )
        self.assertEqual(
            evidence["external_identifier_lengths"], {"below_limit": 11, "at_limit": 12, "above_limit": 13}
        )
        self.assertIn("maxLength: 12", load_changed_openapi().read_text(encoding="utf-8"))
        self.assertIn("maxLength: 100", load_openapi().read_text(encoding="utf-8"))
