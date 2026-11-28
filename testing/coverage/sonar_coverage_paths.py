"""Rewrite coverage.xml <source> paths from the backend container to the checkout.

coverage.py runs inside the CARE container, where the code lives under /app.
SonarQube scans the checkout, where the same code lives under care/. This writes
testing/coverage/coverage-sonar.xml with the sources mapped accordingly.

Usage (repository root): python testing/coverage/sonar_coverage_paths.py
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "testing" / "coverage" / "coverage.xml"
DST = ROOT / "testing" / "coverage" / "coverage-sonar.xml"


def main() -> int:
    if not SRC.exists():
        print(f"FAIL: {SRC} not found")
        return 1
    tree = ET.parse(SRC)
    sources = tree.getroot().find("sources")
    mapped = 0
    for source in sources.findall("source") if sources is not None else []:
        text = (source.text or "").strip().rstrip("/")
        # /app (include-only config: filenames are "care/emr/...") or
        # /app/<pkg> (source-based config: filenames are relative to the package)
        if text == "/app" or text.startswith("/app/"):
            source.text = str(ROOT / "care" / text[len("/app") :].lstrip("/")).replace("\\", "/")
            mapped += 1
    if mapped == 0:
        print("FAIL: no /app/ sources found to map")
        return 1
    tree.write(DST, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {DST.relative_to(ROOT)} ({mapped} sources mapped to care/)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
