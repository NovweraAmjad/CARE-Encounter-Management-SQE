from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

ACTIVE_STATUSES = ("planned", "in_progress", "on_hold")
TERMINAL_STATUSES = (
    "completed",
    "cancelled",
    "entered_in_error",
    "discontinued",
)


def encounter_create_payload(patient, facility, organization, status="in_progress"):
    return {
        "patient": str(patient),
        "facility": str(facility),
        "status": status,
        "encounter_class": "imp",
        "priority": "routine",
        "organizations": [str(organization)],
        "period": {"start": timezone.now().isoformat()},
    }


def restart_age_cases():
    return (
        ("just_below_limit", timedelta(hours=23, minutes=59)),
        ("exactly_at_limit", timedelta(hours=24)),
        ("just_above_limit", timedelta(hours=24, minutes=1)),
        ("far_above_limit", timedelta(days=7)),
    )


def load_openapi():
    return __import__("pathlib").Path(__file__).resolve().parents[1] / "openapi" / "encounter-openapi.yaml"


def load_changed_openapi():
    """The regenerated spec (two constraints changed), written by write_changed_spec()."""
    return load_openapi().with_name("encounter-openapi.v2.yaml")


def read_openapi_constraints(spec_path=None):
    spec_path = spec_path or load_openapi()
    text = spec_path.read_text(encoding="utf-8")

    def enum_values(field_name):
        marker = f"        {field_name}:"
        start = text.find(marker)
        if start < 0:
            return []
        values = []
        in_enum = False
        for line in text[start:].splitlines()[1:]:
            stripped = line.strip()
            if stripped == "enum:":
                in_enum = True
                continue
            if in_enum and stripped.startswith("- "):
                values.append(stripped[2:].strip())
                continue
            if in_enum:
                break
        return values

    def x_value(name, default):
        line = next((line for line in text.splitlines() if f"x-{name}:" in line), None)
        return int(line.split(":", 1)[1].strip()) if line else default

    return {
        "statuses": enum_values("status"),
        "classes": enum_values("encounter_class"),
        "priorities": enum_values("priority"),
        "external_identifier_max_length": x_value(
            "care-external-identifier-max-length",
            100,
        ),
        "active_encounter_limit": x_value(
            "care-active-encounter-limit",
            5,
        ),
    }


def generated_encounter_payload(patient, facility, organization, status="in_progress"):
    constraints = read_openapi_constraints()
    if status not in constraints["statuses"]:
        raise ValueError("Generated status is not in the OpenAPI enum")
    payload = encounter_create_payload(
        patient,
        facility,
        organization,
        status=status,
    )
    payload["period"] = {}
    return payload


def generated_invalid_values():
    constraints = read_openapi_constraints()
    return {
        "status": "not-a-status",
        "encounter_class": "not-a-class",
        "priority": "not-a-priority",
        "patient": "not-a-uuid",
        "facility": "not-a-uuid",
        "external_identifier": "X"
        * (constraints["external_identifier_max_length"] + 1),
    }


CHANGED_CONSTRAINTS = {
    # constraint: (original, changed) - the two constraints changed for regeneration
    "active_encounter_limit": (5, 3),
    "external_identifier_max_length": (100, 12),
}


def generate_cases(spec_path=None):
    """Read the OpenAPI spec and produce equivalence classes and 3-point BVA values.

    EP: every valid enum value is its own valid class; each invalid class has ONE
    invalid value, so a test changes one input at a time.
    BVA: just below, exactly at and just above every numeric/length limit, with the
    outcome the business rule predicts.
    """
    spec_path = spec_path or load_openapi()
    c = read_openapi_constraints(spec_path)
    limit = c["active_encounter_limit"]
    max_len = c["external_identifier_max_length"]
    return {
        "spec": spec_path.name,
        "constraints": c,
        "equivalence_classes": {
            "status": {"valid": c["statuses"], "invalid": ["not-a-status"]},
            "encounter_class": {"valid": c["classes"], "invalid": ["not-a-class"]},
            "priority": {"valid": c["priorities"], "invalid": ["not-a-priority"]},
            "patient": {"valid": ["existing patient UUID"], "invalid": ["not-a-uuid", "well-formed UUID that does not exist"]},
            "facility": {"valid": ["existing facility UUID"], "invalid": ["not-a-uuid", "well-formed UUID that does not exist"]},
            "external_identifier": {"valid": ["null", f"string of length 1..{max_len}"], "invalid": [f"string longer than {max_len}"]},
        },
        "boundary_values": {
            # BR-ENC-01: creation allowed only while the active count BEFORE create < limit
            "active_encounters_before_create": {
                "below": limit - 1, "at": limit, "above": limit + 1,
                "expected": {"below": "created", "at": "rejected (400)", "above": "rejected (400)"},
            },
            "external_identifier_length": {
                "below": max_len - 1, "at": max_len, "above": max_len + 1,
                "expected": {"below": "accepted", "at": "accepted", "above": "rejected by the spec; the API returns 500 (DEF-01)"},
            },
        },
    }


def write_changed_spec():
    """Write openapi/encounter-openapi.v2.yaml: the original spec with the two
    constraints in CHANGED_CONSTRAINTS changed. Returns its path."""
    original = load_openapi().read_text(encoding="utf-8")
    old_limit, new_limit = CHANGED_CONSTRAINTS["active_encounter_limit"]
    old_len, new_len = CHANGED_CONSTRAINTS["external_identifier_max_length"]
    replacements = [
        ('version: "1.0"', 'version: "2.0"'),
        (f"x-care-active-encounter-limit: {old_limit}", f"x-care-active-encounter-limit: {new_limit}"),
        (f"x-care-external-identifier-max-length: {old_len}", f"x-care-external-identifier-max-length: {new_len}"),
        (f"          maxLength: {old_len}", f"          maxLength: {new_len}"),
    ]
    changed = original
    for old, new in replacements:
        if old not in changed:
            raise ValueError(f"constraint text not found in spec: {old!r}")
        changed = changed.replace(old, new, 1)
    path = load_changed_openapi()
    path.write_text(
        "# REGENERATED v2: active-encounter limit 5 -> 3; external_identifier maxLength 100 -> 12.\n"
        "# Written by testing/generators/encounter_data_generator.py::write_changed_spec().\n"
        + changed,
        encoding="utf-8",
    )
    return path


def regenerated_constraints():
    """Change two constraints, write the updated spec, regenerate the cases from both
    specs and record the effect in testing/evidence/two-constraint-regeneration.json."""
    from pathlib import Path
    import json

    before = generate_cases(load_openapi())
    after = generate_cases(write_changed_spec())
    effect = []
    for name in ("active_encounters_before_create", "external_identifier_length"):
        b, a = before["boundary_values"][name], after["boundary_values"][name]
        effect.append({
            "boundary": name,
            "before": {k: b[k] for k in ("below", "at", "above")},
            "after": {k: a[k] for k in ("below", "at", "above")},
        })
    evidence = {
        "original_spec": before["spec"],
        "changed_spec": after["spec"],
        "changed_constraints": {k: {"from": v[0], "to": v[1]} for k, v in CHANGED_CONSTRAINTS.items()},
        "original": before["constraints"],
        "changed": after["constraints"],
        "boundary_effect": effect,
        "cases_before": before,
        "cases_after": after,
        # Keys used by the API tests (values come from the regenerated spec).
        "active_limit_values": {
            "below": after["boundary_values"]["active_encounters_before_create"]["below"],
            "equal": after["boundary_values"]["active_encounters_before_create"]["at"],
            "above": after["boundary_values"]["active_encounters_before_create"]["above"],
        },
        "external_identifier_lengths": {
            "below_limit": after["boundary_values"]["external_identifier_length"]["below"],
            "at_limit": after["boundary_values"]["external_identifier_length"]["at"],
            "above_limit": after["boundary_values"]["external_identifier_length"]["above"],
        },
    }
    evidence_path = Path(__file__).resolve().parents[1] / "evidence" / "two-constraint-regeneration.json"
    evidence_path.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    return evidence
