"""Build the survivor register from REAL mutmut output.

Input : results/after-test-improvement/baseline-survivor-diffs.tsv
        (mutant name <TAB> status after test improvement <TAB> diff), produced by
        `mutmut show` for every mutant that SURVIVED the trustworthy baseline run.
Output: results/survivor-analysis.json and a Markdown table used by
        testing/evidence/mutation-analysis.md.

Every mutant gets one classification:
  equivalent      - no test can tell it apart from the original (reason given)
  missing-test    - no test exercised the behaviour; a test was added
  weak-assertion  - a test exercised it but did not assert the changed detail
  not-killed-defect - killing it would require asserting a confirmed defect (DEF-19)
The script FAILS if a mutant classified killable is not 'killed' in the after
run, or one classified equivalent/defect did not survive, so the register
cannot drift from the measured results.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TSV = HERE / "results" / "after-test-improvement" / "baseline-survivor-diffs.tsv"
OUT = HERE / "results" / "survivor-analysis.json"
MD = HERE / "results" / "survivor-analysis.md"

EQUIVALENT = {
    ("EncounterViewSet.authorize_retrieve", 10): "Return value of authorize_retrieve is ignored by EMRRetrieveMixin.retrieve (base.py:78-82); only raising matters. Verified: mutant passes the 3 retrieve tests when run directly.",
    ("EncounterViewSet.authorize_retrieve", 19): "Same as mutant 10 for the encounter-permission branch.",
    ("EncounterViewSet.perform_create", 4): "EncounterCreateSpec.perform_extra_deserialization always sets _organizations, so the getattr default is never used.",
    ("EncounterViewSet.perform_create", 7): "As mutant 4: the attribute always exists, so getattr without a default behaves the same.",
    ("EncounterViewSet.perform_create", 21): "Organization cache is synced elsewhere as well (EncounterOrganization.save and the create path). Verified: API-ENC-042 passes against this mutant.",
    ("EncounterViewSet.perform_create", 28): "update_fields=None saves every field; the stored values are identical (same object, same values).",
    ("EncounterViewSet.perform_create", 46): "patient.save() without update_fields writes the same values; observable state identical.",
    ("EncounterListSpec.perform_extra_serialization", 17): "Key of a None value changed; the field's default is already None, so the response is identical.",
    ("EncounterListSpec.perform_extra_serialization", 18): "As mutant 17.",
    ("EncounterRetrieveSpec.perform_extra_serialization", 38): "Key of a None value changed; the field's default is already None.",
    ("EncounterRetrieveSpec.perform_extra_serialization", 39): "As mutant 38.",
}
for i in range(9, 15):
    EQUIVALENT[("EncounterViewSet.get_queryset", i)] = (
        "Removes one select_related() argument: changes only the number of SQL queries, not the result."
    )

KILLED_BY = {
    "EncounterViewSet.validate_data": {5: ("missing-test", "API-ENC-033"), 13: ("weak-assertion", "UNIT-ENC-002 (exact message)"), 19: ("weak-assertion", "UNIT-ENC-003 (exact message)")},
    "EncounterViewSet.authorize_create": ("API-ENC-036", {1: "missing-test", 9: "missing-test"}, "weak-assertion"),
    "EncounterViewSet.authorize_update": ("API-ENC-037", {}, "weak-assertion"),
    "EncounterCreateSpec.perform_extra_deserialization": {25: ("missing-test", "API-ENC-039"), 40: ("weak-assertion", "API-ENC-034")},
    "EncounterUpdateSpec.perform_extra_deserialization": {11: ("weak-assertion", "API-ENC-035"), 12: ("missing-test", "API-ENC-035")},
    "EncounterRetrieveSpec.perform_extra_serialization": ("API-ENC-041", {8: ("missing-test", "API-ENC-034"), 10: ("missing-test", "API-ENC-034")}, "missing-test"),
}
MESSAGE_MUTANTS_GET_QS = set(range(55, 59)) | set(range(89, 93))


def classify(func: str, num: int, diff: str):
    if (func, num) in EQUIVALENT:
        return "equivalent", EQUIVALENT[(func, num)], None
    if func == "LiveFilter.filter":
        return ("not-killed-defect",
                "Killing it needs a test that asserts live=true/false semantics; the current semantics are inverted (DEF-19), so such a test would either fail or lock in the defect.",
                None)
    if func == "EncounterViewSet.get_queryset":
        kind = "weak-assertion" if num in MESSAGE_MUTANTS_GET_QS else "missing-test"
        return kind, "List access paths (?patient=, no filter, second facility) were untested.", "API-ENC-038"
    if func == "EncounterViewSet.perform_create":
        if 22 <= num <= 25 or 37 <= num <= 40:
            return "weak-assertion", "Error message text was not asserted.", "API-ENC-039" if num <= 25 else "API-ENC-040"
        if 26 <= num <= 34:
            return "missing-test", "Booking association was never read back after create.", "API-ENC-039"
        if num in (41, 42, 45):
            return "missing-test", "Facility default identifiers were never checked after create.", "API-ENC-034"
    spec = KILLED_BY.get(func)
    if isinstance(spec, dict) and num in spec:
        kind, test = spec[num]
        return kind, "See the named test.", test
    if isinstance(spec, tuple):
        test, overrides, default_kind = spec
        o = overrides.get(num)
        if isinstance(o, tuple):
            return o[0], "See the named test.", o[1]
        kind = o or default_kind
        reason = "Error message text was not asserted." if "PermissionDenied" in diff else "Behaviour was not asserted."
        return kind, reason, test
    return "unclassified", "", None


def main() -> int:
    rows = []
    problems = []
    for line in TSV.read_text(encoding="utf-8").splitlines():
        name, after, diff = (line.split("\t") + ["", ""])[:3]
        m = re.match(r"care\.emr\.(?:api\.viewsets|resources)\.encounter(?:\.spec)?\.xǁ(\w+)ǁ(\w+)__mutmut_(\d+)", name)
        if not m:
            problems.append(f"unparsed name {name}")
            continue
        func, num = f"{m.group(1)}.{m.group(2)}", int(m.group(3))
        kind, reason, test = classify(func, num, diff)
        rows.append({"mutant": name, "function": func, "number": num, "diff": diff.strip(),
                     "classification": kind, "reason": reason, "killing_test": test,
                     "status_after_test_improvement": after})
        killable = kind in ("missing-test", "weak-assertion")
        if kind == "unclassified":
            problems.append(f"{func}#{num} unclassified")
        elif killable and after != "killed":
            problems.append(f"{func}#{num} classified {kind} but is '{after}' after improvement")
        elif not killable and after != "survived":
            problems.append(f"{func}#{num} classified {kind} but is '{after}' after improvement")

    counts = {}
    for r in rows:
        counts[r["classification"]] = counts.get(r["classification"], 0) + 1
    summary = {
        "source": "mutmut 3.8.1, trustworthy baseline run (fixed harness, 1 worker) vs run after test improvement",
        "baseline": json.loads((HERE / "results" / "baseline-before-test-improvement" / "mutmut-cicd-stats.json").read_text()),
        "after_test_improvement": json.loads((HERE / "results" / "after-test-improvement" / "mutmut-cicd-stats.json").read_text()),
        "survivors_analysed": len(rows),
        "classification_counts": counts,
        "killed_after_improvement": sum(r["status_after_test_improvement"] == "killed" for r in rows),
        "consistency_problems": problems,
        "mutants": rows,
    }
    OUT.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    md = ["| # | Function | Mutant | Change | Class | Killing test | After |", "|---|---|---|---|---|---|---|"]
    for i, r in enumerate(rows, 1):
        change = r["diff"].replace("|", "\\|")[:110]
        md.append(f"| {i} | `{r['function']}` | {r['number']} | `{change}` | {r['classification']} | {r['killing_test'] or '—'} | {r['status_after_test_improvement']} |")
    MD.write_text("\n".join(md) + "\n", encoding="utf-8")

    print(json.dumps({k: summary[k] for k in ("survivors_analysed", "classification_counts", "killed_after_improvement")}, indent=1))
    if problems:
        print("CONSISTENCY PROBLEMS:", *problems, sep="\n  ")
        return 1
    print("Register consistent with measured results.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
