/**
 * Admin-view filter for talent records (Person / CreatorProfile).
 *
 * PR #51 seeded ~18 DEMO_COMPOSITE personas so the producer engine
 * has talent to score against. Composites are first-class citizens
 * inside the tracer (the producer must see them; the candidate-card
 * UI surfaces a "Composite" badge). But admin views like
 * `/admin/people` and `/admin/creator-profiles` are for reviewing
 * *real* talent — when the real-talent pool eventually grows
 * alongside the seed, the admin "Production network" / "Creator
 * network" lists would silently blend the two. This helper makes
 * the default behavior "hide composites" and gives admins an
 * explicit opt-in.
 *
 * Why a centralised helper:
 *   - More than one admin page needs the same filter
 *   - Consistent label + URL toggle across all surfaces
 *   - Single place to flip semantics later (e.g., when we add
 *     another "demo-only" source like DEMO_RESEARCH)
 *
 * Framework-agnostic — no Next.js imports. Plain Prisma filter
 * fragments + a URL parser. Liftable into `apps/app-server` for
 * Phase 2.
 */

import type { Prisma } from "@prisma/client";

/**
 * The query-string key admin pages use to opt-in to seeing
 * composites. `?includeComposites=1` (or `=true`, `=yes`) toggles
 * the filter off — anything else (including missing) keeps
 * composites hidden.
 */
export const ADMIN_INCLUDE_COMPOSITES_QUERY_KEY = "includeComposites";

/**
 * Parses the `includeComposites` query param into a boolean. The
 * Next.js searchParams shape is `string | string[] | undefined`
 * per route handler — accept all three.
 */
export function shouldIncludeComposites(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams | null | undefined,
): boolean {
  if (!searchParams) return false;
  const raw =
    searchParams instanceof URLSearchParams
      ? searchParams.get(ADMIN_INCLUDE_COMPOSITES_QUERY_KEY)
      : pickFirst(searchParams[ADMIN_INCLUDE_COMPOSITES_QUERY_KEY]);
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/**
 * Prisma `where` fragment for `Person` queries. When `includeComposites`
 * is false (the default), excludes rows whose `source = DEMO_COMPOSITE`.
 * When true, returns an empty filter (no source restriction).
 */
export function buildAdminPersonWhere({
  includeComposites,
}: {
  includeComposites: boolean;
}): Prisma.PersonWhereInput {
  if (includeComposites) return {};
  return { source: { not: "DEMO_COMPOSITE" } };
}

/**
 * Prisma `where` fragment for `CreatorProfile` queries. CreatorProfile
 * doesn't carry its own `source` — the source lives on the parent
 * `Person`, so we filter via the relation.
 */
export function buildAdminCreatorProfileWhere({
  includeComposites,
}: {
  includeComposites: boolean;
}): Prisma.CreatorProfileWhereInput {
  if (includeComposites) return {};
  return { person: { source: { not: "DEMO_COMPOSITE" } } };
}

/**
 * Human-friendly label for the filter state. Use in admin headers
 * so the admin knows whether composites are currently visible.
 */
export function adminCompositeFilterLabel({
  includeComposites,
}: {
  includeComposites: boolean;
}): string {
  return includeComposites
    ? "Showing real talent + composites"
    : "Hiding composites (real talent only)";
}
