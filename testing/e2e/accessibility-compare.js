/**
 * Compare the before/after accessibility runs and de-duplicate tool findings.
 *
 * Usage (from testing/e2e): node accessibility-compare.js
 * Reads : testing/accessibility/{before,after}/audit-summary.json + axe-*-summary.json
 * Writes: testing/accessibility/comparison.md and comparison.json
 *
 * One issue = (screen, rule id). Lighthouse's accessibility audits use axe-core rule
 * ids, so an issue reported by both tools is counted once with detectedBy = both.
 * Best-practices / SEO failures are Lighthouse-only issues. Audits with weight 0
 * that are dev-server artifacts (valid-source-maps) are listed separately.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "accessibility");
const DEV_ONLY = new Set(["valid-source-maps"]);
const load = (phase, file) => JSON.parse(fs.readFileSync(path.join(ROOT, phase, file), "utf8"));

function issuesFor(phase) {
  const summary = load(phase, "audit-summary.json");
  const issues = new Map();
  const devArtifacts = [];
  const add = (screen, id, tool, detail) => {
    const key = `${screen}|${id}`;
    const entry = issues.get(key) ?? { screen, id, detectedBy: new Set(), details: [] };
    entry.detectedBy.add(tool);
    entry.details.push(detail);
    issues.set(key, entry);
  };
  for (const [screen, data] of Object.entries(summary.screens)) {
    const axe = load(phase, `axe-${screen}-summary.json`);
    for (const v of axe.violations) {
      add(screen, v.id, "axe-core", { impact: v.impact, help: v.help, elements: v.nodes.map((n) => n.target.join(" ")) });
    }
    for (const run of ["lighthouseNavigation", "lighthouseSnapshot"]) {
      const lh = data[run];
      if (!lh) continue;
      for (const [category, audits] of Object.entries(lh.failingAudits)) {
        for (const a of audits) {
          if (DEV_ONLY.has(a.id)) {
            devArtifacts.push({ screen, id: a.id, run: lh.mode });
            continue;
          }
          add(screen, a.id, `Lighthouse (${lh.mode})`, {
            category, weight: a.weight, title: a.title,
            elements: a.items.map((i) => i.selector ?? `${i.description ?? ""} ${i.url ?? ""}`.trim()),
          });
        }
      }
    }
  }
  return { summary, issues, devArtifacts };
}

const before = issuesFor("before");
const after = issuesFor("after");
const keys = [...new Set([...before.issues.keys(), ...after.issues.keys()])].sort();
const rows = keys.map((k) => {
  const b = before.issues.get(k);
  const a = after.issues.get(k);
  const any = b ?? a;
  return {
    screen: any.screen,
    rule: any.id,
    detectedBy: [...new Set([...(b?.detectedBy ?? []), ...(a?.detectedBy ?? [])])].sort(),
    before: b ? "present" : "absent",
    after: a ? "present" : "absent",
    status: b && !a ? "FIXED" : b && a ? "remaining" : "new",
    impact: any.details.find((d) => d.impact)?.impact ?? null,
    elements_before: [...new Set((b?.details ?? []).flatMap((d) => d.elements))],
  };
});

const scoreRows = [];
for (const screen of Object.keys(before.summary.screens)) {
  for (const run of ["lighthouseNavigation", "lighthouseSnapshot"]) {
    const b = before.summary.screens[screen][run];
    const a = after.summary.screens[screen]?.[run];
    if (!b) continue;
    for (const cat of Object.keys(b.scores)) {
      scoreRows.push({ screen, run: b.mode, url: b.url, category: cat, before: b.scores[cat], after: a?.scores[cat] ?? null });
    }
  }
}
const axeRows = Object.keys(before.summary.screens).map((screen) => ({
  screen,
  before: before.summary.screens[screen].axe.violationCount,
  after: after.summary.screens[screen]?.axe.violationCount ?? null,
  beforeRules: before.summary.screens[screen].axe.rules,
  afterRules: after.summary.screens[screen]?.axe.rules ?? [],
}));

const out = { generated: new Date().toISOString(), before: before.summary.generated, after: after.summary.generated, scores: scoreRows, axe: axeRows, issues: rows, devArtifacts: before.devArtifacts };
fs.writeFileSync(path.join(ROOT, "comparison.json"), JSON.stringify(out, null, 2));

const pct = (v) => (v === null || v === undefined ? "—" : Math.round(v * 100));
let md = `# Accessibility before/after comparison\n\n`;
md += `- Before run: ${before.summary.generated}\n- After run: ${after.summary.generated}\n- Fixed screen: **Create Encounter** (see \`after/care_fe-create-encounter-fix.patch\`)\n\n`;
md += `## Lighthouse scores (0–100)\n\n| Screen | Mode | Category | Before | After | Change |\n|---|---|---|---:|---:|---:|\n`;
for (const r of scoreRows) {
  const d = r.after === null ? "—" : pct(r.after) - pct(r.before);
  md += `| ${r.screen} | ${r.run} | ${r.category} | ${pct(r.before)} | ${pct(r.after)} | ${d > 0 ? "+" : ""}${d} |\n`;
}
md += `\n## axe-core violations (rules)\n\n| Screen | Before | After | Rules before | Rules after |\n|---|---:|---:|---|---|\n`;
for (const r of axeRows) md += `| ${r.screen} | ${r.before} | ${r.after} | ${r.beforeRules.join(", ") || "—"} | ${r.afterRules.join(", ") || "—"} |\n`;
md += `\n## Unique issues (an issue found by both tools is counted once)\n\n| Screen | Rule | Detected by | axe impact | Before | After | Status |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| ${r.screen} | \`${r.rule}\` | ${r.detectedBy.join(" + ")} | ${r.impact ?? "—"} | ${r.before} | ${r.after} | **${r.status}** |\n`;
md += `\nUnique issues before: ${rows.filter((r) => r.before === "present").length}; after: ${rows.filter((r) => r.after === "present").length}.\n`;
if (before.devArtifacts.length) {
  md += `\nExcluded as development-server artifacts (weight 0): ${[...new Set(before.devArtifacts.map((d) => `\`${d.id}\``))].join(", ")} — the Vite dev server serves source maps that Lighthouse cannot validate; not present in a production build.\n`;
}
fs.writeFileSync(path.join(ROOT, "comparison.md"), md);
console.log(md);
