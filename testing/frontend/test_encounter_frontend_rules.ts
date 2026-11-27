import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import path from "node:path";

import { encounterRequiresDischarge } from "../../care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts";

const projectRoot = path.resolve(process.cwd(), "..");

test("BR-ENC-04 inpatient/discharged decision table using actual exported function", () => {
  const makeEncounter = (encounterClass: string, status: string) =>
    ({
      encounter_class: encounterClass,
      status,
    }) as Parameters<typeof encounterRequiresDischarge>[0];

  const cases = [
    ["imp", "in_progress", true],
    ["imp", "discharged", false],
    ["amb", "in_progress", false],
    ["amb", "discharged", false],
  ] as const;

  for (const [encounterClass, encounterStatus, expected] of cases) {
    assert.equal(
      encounterRequiresDischarge(
        makeEncounter(encounterClass, encounterStatus),
      ),
      expected,
      `${encounterClass}/${encounterStatus}`,
    );
  }
});

test("BR-ENC-02 future-start source contract remains visible in actual component", () => {
  const sourcePath = path.resolve(
    projectRoot,
    "care_fe/src/components/Encounter/CreateEncounterForm.tsx",
  );
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data\.status !== EncounterStatus\.PLANNED/);
  assert.match(source, /new Date\(data\.start_date\) > new Date\(\)/);
  assert.match(source, /encounter_future_date_restriction/);
});

test("BR-ENC-05 completion-period source contract remains visible in actual controller", () => {
  const sourcePath = path.resolve(
    projectRoot,
    "care_fe/src/pages/Encounters/utils/useEncounterProgressController.ts",
  );
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /start: encounter\.period\.start/);
  assert.match(source, /end: encounter\.period\.end \|\| new Date\(\)\.toISOString\(\)/);
});
