import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  adminNavSections,
  adminRouteInventory,
  flattenAdminNavItems,
  getAdminChevronDirection,
  getAdminSectionOpenState,
  isAdminNavItemActive,
  isAdminNavSectionActive,
  sidebarRendersItemDescriptions,
} from "@/components/admin/adminNavigation";
import { buildNeedsAttentionSummary } from "@/sms-engine/admin/needsAttention";
import { assertNoRawPiiOrSecrets } from "@/sms-engine/dataOps/dataClassification";

const root = process.cwd();
const adminAppDir = join(root, "src/app/admin");
const rawPhone = "+15551234567";
const rawEmail = "person@example.com";
const rawSecret = "sk-test-secret";

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

function assertNoUnsafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const unsafe of [rawPhone, "555-123-4567", rawEmail, rawSecret, "postgres://secret"]) {
    assert.equal(serialized.includes(unsafe), false, `Unsafe value leaked: ${unsafe}`);
  }
  assert.equal(assertNoRawPiiOrSecrets(value), true);
}

async function main() {
  const routeInventoryPaths = new Set(adminRouteInventory.map((item) => item.routePath));
  const pageRoutes = walk(adminAppDir)
    .filter((file) => file.endsWith("/page.tsx"))
    .map(routeFromPageFile)
    .sort();

  for (const route of pageRoutes) {
    assert.ok(routeInventoryPaths.has(route), `${route} missing from route inventory`);
  }

  const navHrefs = new Set(
    flattenAdminNavItems().map((item) => item.href.split("?")[0]),
  );
  for (const route of adminRouteInventory) {
    if (route.appearsInMainSidebar) {
      assert.ok(navHrefs.has(route.routePath), `${route.routePath} missing from nav config`);
    } else {
      assert.ok(
        route.directAccessOnly || route.routePath.includes("["),
        `${route.routePath} should be direct-access or represented in nav`,
      );
    }
  }

  assert.equal(adminNavSections[0]?.id, "command-center");
  assert.equal(adminNavSections[0]?.collapsible, false);
  assert.equal(adminNavSections[1]?.id, "needs-attention");
  assert.equal(adminNavSections[1]?.collapsible, false);

  const projectsItem = flattenAdminNavItems().find((item) => item.href === "/admin/projects");
  assert.ok(projectsItem);
  assert.equal(isAdminNavItemActive("/admin/projects", projectsItem), true);

  const projectsSection = adminNavSections.find((section) => section.id === "projects");
  assert.ok(projectsSection);
  assert.equal(isAdminNavSectionActive("/admin/projects/demo", projectsSection), true);
  assert.equal(getAdminSectionOpenState("/admin/projects/demo").projects, true);
  assert.equal(
    getAdminSectionOpenState("/admin/projects/demo", { projects: false }).projects,
    false,
    "Operators should be able to close the active dropdown after page load",
  );
  assert.equal(getAdminChevronDirection(false), "right");
  assert.equal(getAdminChevronDirection(true), "down");
  assert.equal(sidebarRendersItemDescriptions, false);

  for (const item of flattenAdminNavItems()) {
    assert.ok(item.label.length <= 24, `${item.label} is too long for the simplified sidebar`);
  }

  const advanced = adminNavSections.find((section) => section.id === "advanced");
  assert.ok(advanced?.items.some((item) => item.href === "/admin/dev"));

  const consolidationDoc = join(root, "docs/admin-page-consolidation-plan-v0.2.md");
  assert.ok(existsSync(consolidationDoc), "Consolidation plan doc missing");
  const consolidation = readFileSync(consolidationDoc, "utf8");
  assert.match(consolidation, /Network Projects/i);
  assert.match(consolidation, /folded into Projects/i);

  const attention = buildNeedsAttentionSummary([
    {
      id: "test:1",
      type: "outbound_draft",
      severity: "needs_review",
      title: `Draft for ${rawPhone}`,
      description: `Email ${rawEmail} with ${rawSecret}`,
      href: "/admin/outbound-drafts",
      createdAt: "2026-01-01T00:00:00.000Z",
      source: "test",
    },
    {
      id: "test:2",
      type: "pipeline_job",
      severity: "critical",
      title: "Pipeline job failed",
      description: "Review the failed job.",
      href: "/admin/pipeline",
      createdAt: "2026-01-02T00:00:00.000Z",
      source: "test",
    },
  ]);
  assert.equal(attention.totalCount, 2);
  assert.equal(attention.pendingApprovalCount, 1);
  assert.equal(attention.reviewCount, 1);
  assert.equal(attention.criticalCount, 1);
  assertNoUnsafe(attention);

  const serializedNav = JSON.stringify({ adminNavSections, adminRouteInventory });
  assertNoUnsafe(serializedNav);

  assert.equal(attention.noSmsSent, true);
  assert.equal(attention.noTwilioRequired, true);
  assert.equal(attention.noProductionSagaAppDataRequired, true);
  assert.notEqual(process.env.LLM_MODE, "active_live");
  assert.notEqual(process.env.MESSAGE_PROCESSING_MODE, "async_active");

  console.log(
    "Admin information architecture checks passed without SMS, Twilio, or production Saga data.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
