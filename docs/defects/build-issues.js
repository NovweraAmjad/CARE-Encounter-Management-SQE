// Generates GitHub issue bodies (issues/DEF-xx.md) and create-issues.ps1 from defects.json.
// Usage: node docs/defects/build-issues.js
const fs = require("node:fs");
const path = require("node:path");

const dir = __dirname;
const defects = JSON.parse(fs.readFileSync(path.join(dir, "defects.json"), "utf8"));
fs.mkdirSync(path.join(dir, "issues"), { recursive: true });

const labels = new Set();
const lines = [
  "# Creates the defect GitHub Issues. Requires the GitHub CLI and `gh auth login`.",
  "# Run from the repository root:  powershell -File docs/defects/create-issues.ps1",
  '$ErrorActionPreference = "Stop"',
  '$repo = "NovweraAmjad/CARE-Encounter-Management-SQE"',
];
const creates = [];
for (const d of defects) {
  const body = [
    `**Defect ID:** ${d.id}`,
    `**Severity:** ${d.severity}  |  **Priority:** ${d.priority}  |  **Status:** ${d.status}`,
    `**Category:** ${d.category}`,
    `**Triage decision:** ${d.triage}`,
    "",
    "### Steps to reproduce",
    ...d.steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `### Expected\n${d.expected}`,
    "",
    `### Actual\n${d.actual}`,
    "",
    `### Evidence\n${d.evidence}`,
    "",
    "_Environment: local CARE copy, synthetic fixture data only (see docs/test-plan.md)._",
  ].join("\n");
  const file = path.join(dir, "issues", `${d.id}.md`);
  fs.writeFileSync(file, `${body}\n`);
  const issueLabels = [`severity:${d.severity}`, `priority:${d.priority}`, `status:${d.status}`, `category:${d.category}`, "defect"];
  issueLabels.forEach((l) => labels.add(l));
  const title = `[${d.id}] ${d.title}`.replace(/"/g, "'");
  creates.push(
    `gh issue create --repo $repo --title "${title}" --body-file "docs/defects/issues/${d.id}.md" ${issueLabels.map((l) => `--label "${l}"`).join(" ")}`,
  );
  if (["Fixed", "Won't fix"].includes(d.status)) {
    creates.push(`# ${d.id} is ${d.status}: after creating it, close it with: gh issue close <number> --repo $repo --reason ${d.status === "Fixed" ? "completed" : '"not planned"'}`);
  }
}
for (const l of [...labels].sort()) lines.push(`gh label create "${l}" --repo $repo --force | Out-Null`);
lines.push(...creates);
fs.writeFileSync(path.join(dir, "create-issues.ps1"), `${lines.join("\n")}\n`);
console.log(`Wrote ${defects.length} issue bodies and create-issues.ps1 (${labels.size} labels).`);
