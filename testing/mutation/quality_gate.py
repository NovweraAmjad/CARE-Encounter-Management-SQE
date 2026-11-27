from __future__ import annotations

import json
import sys
from pathlib import Path


MUTATION_THRESHOLD = 80.0


def mutation_score(stats: dict) -> float | None:
    killed = int(stats.get("killed", 0))
    survived = int(stats.get("survived", 0))
    denominator = killed + survived
    if denominator == 0:
        return None
    return killed / denominator * 100.0


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    mutation_dir = root / "mutation" / "results"
    candidates = (
        mutation_dir / "mutmut-cicd-stats.json",
        mutation_dir / "mutation-results.json",
    )
    stats = None
    for candidate in candidates:
        if candidate.exists():
            stats = json.loads(candidate.read_text(encoding="utf-8"))
            if candidate.name == "mutmut-cicd-stats.json":
                break
    if not stats:
        print("FAIL: no mutation statistics found")
        return 1
    if stats.get("status") == "pending" or stats.get("reason"):
        print("FAIL: mutation campaign evidence is not measured")
        return 1

    score = mutation_score(stats)
    if score is None:
        print("FAIL: mutation denominator is zero")
        return 1
    if score < MUTATION_THRESHOLD:
        print(f"FAIL: mutation score {score:.2f}% is below {MUTATION_THRESHOLD:.2f}%")
        return 1
    print(f"PASS: mutation score {score:.2f}% meets {MUTATION_THRESHOLD:.2f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
