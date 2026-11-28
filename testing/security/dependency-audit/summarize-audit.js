/**
 * Summarise the Section 4 dependency audit.
 *
 * Inputs (produced by the commands in testing/security/README.md):
 *   backend-pip-audit-osv.json      pip-audit -f json against backend-installed-packages.txt
 *   npm-audit-*.json                npm audit --json per Node project
 *
 * pip-audit lists the same advisory under several IDs (PYSEC / GHSA / CVE), so
 * advisories are grouped by alias. Severity is not in pip-audit output; it is read
 * from the public OSV record of the GHSA alias (database_specific.severity), falling
 * back to "UNRATED" when no rated alias exists.
 *
 * Outputs: dependency-audit-summary.json and dependency-audit-summary.md
 * Usage:   node dependency-audit/summarize-audit.js   (from testing/security)
 */
const fs = require("node:fs");
const path = require("node:path");

const DIR = __dirname;
const SEV_ORDER = ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNRATED"];

// How each flagged backend package is reached in this project (from source review).
const BACKEND_CONTEXT = {
  django: "Core web framework; serves every API request in both workflows.",
  djangorestframework: "API layer for /api/v1/encounter/ and all workflow endpoints.",
  pyjwt: "Signs/verifies the JWT access tokens used by both roles (via djangorestframework-simplejwt).",
  authlib: "JWKS/JOSE handling in config/settings (token signing keys).",
  cryptography: "Crypto primitives used by authlib/pyjwt.",
  pillow: "Image processing for uploads; not exercised by the encounter workflows.",
  urllib3: "Outbound HTTP client (via requests); not on the encounter request path.",
  werkzeug: "[dev-packages] only; serves the LOCAL backend via runserver_plus (scripts/start-dev.sh).",
};

// Direct vs transitive: a package is "direct" if declared in care/Pipfile.
function pipfileSections() {
  const file = path.resolve(DIR, "..", "..", "..", "care", "Pipfile");
  const result = {};
  if (!fs.existsSync(file)) return result;
  let section = null;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const s = line.match(/^\[([^\]]+)\]/);
    if (s) { section = s[1]; continue; }
    const p = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (p && ["packages", "dev-packages", "docs"].includes(section)) {
      result[p[1].toLowerCase().replace(/_/g, "-")] = section;
    }
  }
  return result;
}
const PIPFILE = pipfileSections();
const depType = (name) => {
  const s = PIPFILE[name.toLowerCase()];
  return s ? `direct (Pipfile [${s}])` : "transitive";
};

function npmDeclared(project) {
  const pkg = { care_fe: "../../../care_fe/package.json", "testing-e2e": "../../e2e/package.json",
    "testing-security": "../package.json" }[project];
  if (!pkg) return {};
  const j = JSON.parse(fs.readFileSync(path.resolve(DIR, pkg), "utf8"));
  return {
    ...Object.fromEntries(Object.keys(j.dependencies ?? {}).map((k) => [k, "dependencies"])),
    ...Object.fromEntries(Object.keys(j.devDependencies ?? {}).map((k) => [k, "devDependencies"])),
  };
}

async function osvSeverity(ids) {
  const ghsa = ids.find((i) => i.startsWith("GHSA-"));
  if (!ghsa) return { severity: "UNRATED", source: null, summary: null };
  try {
    const res = await fetch(`https://api.osv.dev/v1/vulns/${ghsa}`);
    if (!res.ok) return { severity: "UNRATED", source: ghsa, summary: null };
    const v = await res.json();
    return {
      severity: (v.database_specific?.severity ?? "UNRATED").toUpperCase(),
      source: ghsa,
      summary: v.summary ?? null,
    };
  } catch {
    return { severity: "UNRATED", source: ghsa, summary: null };
  }
}

async function backend() {
  const report = JSON.parse(fs.readFileSync(path.join(DIR, "backend-pip-audit-osv.json"), "utf8"));
  const checked = report.dependencies.map((d) => `${d.name}==${d.version}`);
  const packages = [];
  for (const dep of report.dependencies.filter((d) => d.vulns?.length)) {
    const groups = [];
    for (const v of dep.vulns) {
      const ids = new Set([v.id, ...(v.aliases ?? [])]);
      const g = groups.find((x) => [...ids].some((i) => x.ids.has(i)));
      if (g) {
        ids.forEach((i) => g.ids.add(i));
        v.fix_versions.forEach((f) => g.fix.add(f));
      } else {
        groups.push({ ids, fix: new Set(v.fix_versions), description: v.description });
      }
    }
    const advisories = [];
    for (const g of groups) {
      const ids = [...g.ids].sort();
      const sev = await osvSeverity(ids);
      advisories.push({
        ids,
        severity: sev.severity,
        severity_source: sev.source,
        summary: sev.summary ?? (g.description ?? "").split("\n")[0].slice(0, 160),
        fix_versions: [...g.fix].sort(),
      });
    }
    const counts = Object.fromEntries(SEV_ORDER.map((s) => [s, advisories.filter((a) => a.severity === s).length]));
    packages.push({
      name: dep.name,
      installed: dep.version,
      dependency_type: depType(dep.name),
      unique_advisories: advisories.length,
      by_severity: counts,
      fix_versions: [...new Set(advisories.flatMap((a) => a.fix_versions))].sort(),
      context: BACKEND_CONTEXT[dep.name] ?? "",
      advisories: advisories.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)),
    });
  }
  return { packages_checked: checked.length, checked, vulnerable: packages };
}

function npm() {
  const out = [];
  for (const f of fs.readdirSync(DIR).filter((x) => /^npm-audit-.*\.json$/.test(x))) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    const declared = npmDeclared(f.replace(/^npm-audit-|\.json$/g, ""));
    const roots = [];
    for (const [name, v] of Object.entries(d.vulnerabilities ?? {})) {
      for (const via of v.via) {
        if (typeof via === "object") {
          roots.push({
            package: name, range: via.range, severity: via.severity.toUpperCase(),
            title: via.title, advisory: via.url, cvss: via.cvss?.score ?? null,
          });
        }
      }
    }
    const affected = Object.entries(d.vulnerabilities ?? {}).map(([name, v]) => ({
      package: name, severity: v.severity.toUpperCase(), direct: v.isDirect, range: v.range,
      dependency_type: declared[name] ? `direct (${declared[name]})` : "transitive",
      fix: typeof v.fixAvailable === "object"
        ? `${v.fixAvailable.name}@${v.fixAvailable.version}${v.fixAvailable.isSemVerMajor ? " (semver-major)" : ""}`
        : String(v.fixAvailable),
    }));
    out.push({
      project: f.replace(/^npm-audit-|\.json$/g, ""),
      dependencies_checked: d.metadata.dependencies.total,
      totals: d.metadata.vulnerabilities,
      root_advisories: roots,
      affected_packages: affected,
    });
  }
  return out;
}

(async () => {
  const be = await backend();
  const fe = npm();
  const summary = { generated: new Date().toISOString(), backend: be, node: fe };
  fs.writeFileSync(path.join(DIR, "dependency-audit-summary.json"), JSON.stringify(summary, null, 2));

  let md = `# Dependency audit summary\n\nGenerated: ${summary.generated}\n\n`;
  md += `## Backend (pip-audit 2.10.1, OSV database)\n\n`;
  md += `Checked **${be.packages_checked}** installed packages (exact versions from \`pip freeze\` in \`care-backend-1\`; list in backend-installed-packages.txt).\n\n`;
  md += `Advisory IDs are de-duplicated by alias (one PYSEC/GHSA/CVE group = one advisory). Raw pip-audit counts before de-duplication: see backend-pip-audit-*.json.\n\n`;
  md += `| Package | Installed | Dependency type | Unique advisories | Critical | High | Moderate | Low | Unrated | Lowest fixed versions | Use in this project |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const p of be.vulnerable) {
    const c = p.by_severity;
    md += `| ${p.name} | ${p.installed} | ${p.dependency_type} | ${p.unique_advisories} | ${c.CRITICAL} | ${c.HIGH} | ${c.MODERATE} | ${c.LOW} | ${c.UNRATED} | ${p.fix_versions.join(", ")} | ${p.context} |\n`;
  }
  const tot = be.vulnerable.reduce((a, p) => { for (const s of SEV_ORDER) a[s] = (a[s] ?? 0) + p.by_severity[s]; return a; }, {});
  md += `| **Total** | | | **${be.vulnerable.reduce((a, p) => a + p.unique_advisories, 0)}** | ${tot.CRITICAL} | ${tot.HIGH} | ${tot.MODERATE} | ${tot.LOW} | ${tot.UNRATED} | | |\n`;
  md += `\n${be.packages_checked - be.vulnerable.length} of ${be.packages_checked} backend packages had no known advisory.\n`;
  md += `\n### Critical and High advisories\n\n| Package | Severity | IDs | Summary | Fixed in |\n|---|---|---|---|---|\n`;
  for (const p of be.vulnerable) {
    for (const a of p.advisories.filter((x) => ["CRITICAL", "HIGH"].includes(x.severity))) {
      md += `| ${p.name} ${p.installed} | ${a.severity} | ${a.ids.filter((i) => /^(CVE|GHSA)/.test(i)).join(", ")} | ${(a.summary ?? "").replace(/\|/g, "/")} | ${a.fix_versions.join(", ")} |\n`;
    }
  }
  md += `\n## Node projects (npm audit)\n\n`;
  for (const n of fe) {
    md += `### ${n.project}\n\nDependencies checked: ${n.dependencies_checked}. Totals: ${JSON.stringify(n.totals)}\n\n`;
    if (n.root_advisories.length) {
      md += `| Root package | Vulnerable range | Severity | Advisory | Title |\n|---|---|---|---|---|\n`;
      for (const r of n.root_advisories) md += `| ${r.package} | ${r.range} | ${r.severity} | ${r.advisory} | ${r.title} |\n`;
      md += `\n| Affected package | Dependency type | Severity | Fix offered by npm |\n|---|---|---|---|\n`;
      for (const a of n.affected_packages) md += `| ${a.package} | ${a.dependency_type} | ${a.severity} | ${a.fix} |\n`;
      if (n.project === "care_fe") {
        md += `\nNote: \`glob\` is labelled direct because care_fe declares \`glob@^14.0.6\`; that installed copy (14.0.6) is outside the vulnerable range. The vulnerable copy is \`workbox-build/node_modules/glob@11.1.0\` (transitive via vite-plugin-pwa), per package-lock.json.\n`;
      }
      md += "\n";
    }
  }
  fs.writeFileSync(path.join(DIR, "dependency-audit-summary.md"), md);
  console.log(md.split("### Critical")[0]);
})();
