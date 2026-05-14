import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  adminNavSections,
  adminRouteInventory,
  flattenAdminNavItems,
  getAdminBreadcrumbs,
  isAdminNavItemActive,
  isAdminNavSectionActive,
} from "@/components/admin/adminNavigation";

const serializedNav = JSON.stringify({ adminNavSections, adminRouteInventory });

function assertNoUnsafeText(value: string) {
  for (const unsafe of [
    "+15551234567",
    "555-123-4567",
    "sk-",
    "TWILIO_AUTH_TOKEN",
    "OPENAI_API_KEY",
    "postgres://",
    "password",
  ]) {
    assert.equal(value.includes(unsafe), false, `Unsafe nav output leaked ${unsafe}`);
  }
}

function main() {
  const sidebarItems = flattenAdminNavItems();
  const sidebarHrefs = new Set(sidebarItems.map((item) => item.href));

  for (const route of adminRouteInventory) {
    if (!route.appearsInMainSidebar) continue;
    assert.ok(
      sidebarHrefs.has(route.routePath),
      `${route.routePath} should be represented in the admin sidebar`,
    );
  }

  for (const section of adminNavSections) {
    const labels = section.items.map((item) => item.label);
    assert.equal(
      new Set(labels).size,
      labels.length,
      `${section.label} has duplicate sidebar labels`,
    );
  }

  assert.equal(adminNavSections[0]?.id, "command-center");
  assert.equal(adminNavSections[0]?.items[0]?.href, "/admin/command-center");
  assert.equal(adminNavSections[0]?.collapsible, false);
  assert.equal(adminNavSections[1]?.id, "needs-attention");
  assert.equal(adminNavSections[1]?.collapsible, false);

  const projectsItem = sidebarItems.find((item) => item.href === "/admin/projects");
  assert.ok(projectsItem, "Project Briefs nav item missing");
  assert.equal(isAdminNavItemActive("/admin/projects", projectsItem), true);
  assert.equal(isAdminNavItemActive("/admin/projects/demo-project", projectsItem), true);

  const projectsSection = adminNavSections.find((section) => section.id === "projects");
  assert.ok(projectsSection, "Projects section missing");
  assert.equal(
    isAdminNavSectionActive("/admin/projects/demo-project", projectsSection),
    true,
    "Nested project pages should open the Projects parent section",
  );

  const advanced = adminNavSections.find((section) => section.id === "advanced");
  assert.ok(advanced, "Advanced section missing");
  assert.ok(
    advanced.items.some((item) => item.href === "/admin/dev"),
    "Admin Dev Lab should be grouped under Test Lab / Advanced",
  );

  const breadcrumbs = getAdminBreadcrumbs("/admin/sourcing/public-web-review");
  assert.deepEqual(
    breadcrumbs.map((breadcrumb) => breadcrumb.label),
    ["Command Center", "Sourcing", "Research Cleanup"],
  );

  const headerMarkup = renderToStaticMarkup(
    <AdminPageHeader
      title="Talent Sourcing"
      description="Find possible collaborators for a project."
      showBreadcrumbs={false}
    />,
  );
  assert.match(headerMarkup, /Talent Sourcing/);
  assert.match(headerMarkup, /Find possible collaborators/);

  assertNoUnsafeText(serializedNav);
  assertNoUnsafeText(headerMarkup);

  const safetySummary = {
    noSmsSent: true,
    noTwilioRequired: true,
    noProductionSagaAppDataRequired: true,
  };
  assert.equal(safetySummary.noSmsSent, true);
  assert.equal(safetySummary.noTwilioRequired, true);
  assert.equal(safetySummary.noProductionSagaAppDataRequired, true);

  console.log(
    "Admin navigation UX checks passed without SMS, Twilio, or production Saga data.",
  );
}

main();
