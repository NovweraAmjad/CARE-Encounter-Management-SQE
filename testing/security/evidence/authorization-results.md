# Authorization check results

Generated: 2026-11-27T20:24:48.421Z

| ID | Role | Action | Request | Expected | Observed (HTTP) | Result | Evidence |
|---|---|---|---|---|---|---|---|
| AC-01 | care-doctor | Read encounter | `GET /api/v1/encounter/{id}/` | Allowed | Allowed (200) | PASS | Response body id matches requested encounter (true) |
| AC-02 | care-volunteer | Read encounter | `GET /api/v1/encounter/{id}/` | Denied | Denied (403) | PASS | Body: {"detail":"You do not have permission to view this patient"} |
| AC-03 | care-doctor | List facility encounters | `GET /api/v1/encounter/?facility={id}` | Allowed | Allowed (200) | PASS | count=323 |
| AC-04 | care-volunteer | List facility encounters | `GET /api/v1/encounter/?facility={id}` | Denied | Denied (200) | PASS | count=0 (queryset filtered by role; see authorization/encounter.py get_filtered_encounters) |
| AC-05 | care-volunteer | Create encounter | `POST /api/v1/encounter/` | Denied | Denied (403) | PASS | Body: {"detail":"You do not have permission to create encounter"} |
| AC-06 | care-volunteer | Update encounter status | `PUT /api/v1/encounter/{id}/` | Denied | Denied (403) | PASS | Body: {"detail":"You do not have permission to update encounter"}; status after request still "planned" |
| AC-07 | care-doctor | Update encounter (same values) | `PUT /api/v1/encounter/{id}/` | Allowed | Allowed (200) | PASS | Encounter status "planned" re-sent unchanged |
| AC-08 | anonymous (no token) | Read encounter | `GET /api/v1/encounter/{id}/` | Denied | Denied (403) | PASS | Body: {"detail":"Authentication credentials were not provided."} |
| AC-09 | care-doctor | Open encounter page (UI) | `/facility/{f}/patient/{p}/encounter/{e}/updates` | Allowed | Allowed (200) | PASS | Encounter region visible; screenshots/AC-09-doctor-encounter.png |
| AC-10 | care-volunteer | Open encounter page (UI) | `/facility/{f}/patient/{p}/encounter/{e}/updates` | Denied | Denied (403) | PASS | Encounter region visible=false; screenshots/AC-10-volunteer-encounter.png |
