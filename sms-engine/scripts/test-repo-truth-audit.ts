import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const docsDir = join(root, "docs");
const adminAppDir = join(root, "src/app/admin");

const requiredAuditDocs = [
  "docs/feature-inventory.md",
  "docs/admin-route-truth-map.md",
  "docs/data-model-truth-map.md",
  "docs/service-file-truth-map.md",
  "docs/test-coverage-map.md",
  "docs/docs-truth-map.md",
  "docs/deployment-runtime-truth-map.md",
  "docs/feature-status-summary.md",
  "docs/redundancy-and-consolidation-map.md",
  "docs/safety-critical-paths-audit.md",
  "docs/engineering-review-priority-list.md",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function routeFromPageFile(file: string) {
  const rel = relative(adminAppDir, file).split(sep).join("/");
  const routePart = rel
    .replace(/\/page\.tsx$/, "")
    .replace(/^page\.tsx$/, "")
    .replace(/\(dashboard\)\//g, "")
    .replace(/\(dashboard\)/g, "");
  return routePart ? `/admin/${routePart}` : "/admin";
}

function readDoc(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function assertDocContains(docPath: string, needle: string, label = needle) {
  const content = readDoc(docPath);
  assert.ok(content.includes(needle), `${docPath} missing ${label}`);
}

function assertNoSecretsOrRawContact(docPaths: string[]) {
  const content = docPaths.map((path) => readDoc(path)).join("\n");
  const rawPhonePattern =
    /(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const secretValuePattern =
    /(sk-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AC[0-9a-fA-F]{30,})/;
  const bannedEnvNames = [
    "DATABASE_URL",
    "ADMIN_PASSWORD",
    "INTERNAL_API_KEY",
    "OPENAI_API_KEY",
    "TWILIO_AUTH_TOKEN",
  ];

  assert.equal(rawPhonePattern.test(content), false, "Audit docs contain a raw phone-like value");
  assert.equal(emailPattern.test(content), false, "Audit docs contain a raw email-like value");
  assert.equal(secretValuePattern.test(content), false, "Audit docs contain a secret-like value");
  for (const name of bannedEnvNames) {
    assert.equal(content.includes(name), false, `Audit docs expose banned env name ${name}`);
  }
}

function prismaModels() {
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  return [...schema.matchAll(/^model\s+(\w+)/gm)].map((match) => match[1]);
}

async function main() {
  for (const doc of requiredAuditDocs) {
    assert.ok(existsSync(join(root, doc)), `${doc} does not exist`);
  }

  const adminRoutes = walk(adminAppDir)
    .filter((file) => file.endsWith(`${sep}page.tsx`))
    .map(routeFromPageFile)
    .sort();
  const adminTruthMap = readDoc("docs/admin-route-truth-map.md");
  for (const route of adminRoutes) {
    assert.ok(adminTruthMap.includes(`\`${route}\``), `${route} missing from admin route truth map`);
  }

  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  const testCoverageMap = readDoc("docs/test-coverage-map.md");
  for (const scriptName of Object.keys(packageJson.scripts)) {
    assert.ok(
      testCoverageMap.includes(`\`${scriptName}\``),
      `${scriptName} missing from test coverage map`,
    );
  }

  const dataModelTruthMap = readDoc("docs/data-model-truth-map.md");
  for (const model of prismaModels()) {
    assert.ok(dataModelTruthMap.includes(`| ${model} |`), `${model} missing from data model truth map`);
  }

  const docsTruthMap = readDoc("docs/docs-truth-map.md");
  const docsFiles = walk(docsDir)
    .filter((file) => file.endsWith(".md") || file.endsWith(".json"))
    .map((file) => relative(root, file).split(sep).join("/"))
    .sort();
  for (const doc of docsFiles) {
    assert.ok(docsTruthMap.includes(`\`${doc}\``), `${doc} missing from docs truth map`);
  }

  assertDocContains("docs/safety-critical-paths-audit.md", "Inbound Twilio webhook");
  assertDocContains("docs/safety-critical-paths-audit.md", "Outbound SMS send path");
  assertDocContains("docs/safety-critical-paths-audit.md", "Needs Attention items");

  assertNoSecretsOrRawContact(requiredAuditDocs);

  assert.notEqual(process.env.LLM_MODE, "active_live");
  assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

  console.log(
    JSON.stringify(
      {
        requiredAuditDocs: requiredAuditDocs.length,
        adminRouteCount: adminRoutes.length,
        modelCount: prismaModels().length,
        scriptCount: Object.keys(packageJson.scripts).length,
        docsCount: docsFiles.length,
        noSmsSent: true,
        noTwilioRequired: true,
        noProductionSagaAppDataRequired: true,
      },
      null,
      2,
    ),
  );
  console.log("Repo truth audit checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
