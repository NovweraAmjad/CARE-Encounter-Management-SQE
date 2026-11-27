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


def read_openapi_constraints():
    spec_path = load_openapi()
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


def regenerated_constraints():
    from copy import deepcopy
    from pathlib import Path
    import json

    original = read_openapi_constraints()
    changed = deepcopy(original)
    changed["active_encounter_limit"] = 3
    changed["external_identifier_max_length"] = 12
    evidence = {
        "original": original,
        "changed": changed,
        "active_limit_values": {
            "below": 2,
            "equal": 3,
            "above": 4,
        },
        "external_identifier_lengths": {
            "at_limit": 12,
            "above_limit": 13,
        },
    }
    evidence_path = (
        Path(__file__).resolve().parents[1]
        / "evidence"
        / "two-constraint-regeneration.json"
    )
    evidence_path.write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    return evidence
