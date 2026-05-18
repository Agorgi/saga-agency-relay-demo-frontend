/**
 * Tracer-side health snapshot for the `/api/health` endpoint.
 *
 * The existing endpoint reports plenty about SMS/Twilio, conversation
 * engine, public-web research, capped beta, and the like — most of
 * which is legacy/admin infrastructure. None of it tells an operator
 * whether the *tracer demo* itself is in a working state. This module
 * fills that gap with four signals an operator (or a debugging
 * developer) wants in one curl:
 *
 *   1. Composite talent pool size — has `npm run seed:creator-pool`
 *      been run against this DB? If the count is below a small
 *      threshold, fresh briefs will surface "real roles, 0 candidates"
 *      cards (PR #51's seed exists but wasn't applied).
 *
 *   2. Project journey counts by step — quick read of how many
 *      projects are at intake / brief_ready / crew_reviewing /
 *      outreach_prep / outreach_awaiting_send / archived. Gives a
 *      one-shot view of where users are getting stuck.
 *
 *   3. Latest applied migration — pulled from Prisma's
 *      `_prisma_migrations` table. Catches the "deployed code expects
 *      a column but the migration didn't apply" failure mode (the
 *      class of bug DEPLOY.md warns about).
 *
 *   4. Producer deterministic health — runs the deterministic
 *      `buildProjectUnderstanding` + `generateRoleMap` pipeline on a
 *      synthetic project input. Catches regressions in the producer
 *      surface area without depending on LLM mode being on.
 *
 * Framework-agnostic — no Next.js imports. Liftable into
 * `apps/app-server` during Phase 2 convergence.
 *
 * Never throws: every probe is wrapped so a single failure (e.g. DB
 * down, missing column) degrades to `*Available: false` without
 * 500ing the whole `/api/health` response.
 */

import { getDb } from "@/sms-engine/db";
import { logServerError } from "@/sms-engine/safeLogging";
import { buildProjectUnderstanding } from "@/sms-engine/producer/projectUnderstanding";
import { generateRoleMap } from "@/sms-engine/producer/roleMap";
import type { ProjectJourneyStep } from "@/lib/journey/types";
import { PROJECT_JOURNEY_STEPS } from "@/lib/journey/types";

/**
 * Below this size, fresh briefs are likely to surface "0 candidates"
 * cards even though the producer is generating roles correctly. The
 * seed script (PR #51) creates ~18 composites; we treat ≥ 8 as
 * "seeded enough to demo." Tuning value, not a contract.
 */
const COMPOSITE_POOL_SEEDED_THRESHOLD = 8;

export type TracerHealthSnapshot = {
  tracerHealthAvailable: boolean;
  compositeTalentPoolSize: number;
  compositeTalentPoolSeeded: boolean;
  projectJourneyCount: number;
  projectJourneyCountByStep: Record<ProjectJourneyStep, number>;
  latestMigration: { name: string; appliedAt: string } | null;
  producerDeterministicHealthy: boolean;
};

const EMPTY_STEP_COUNTS: Record<ProjectJourneyStep, number> = Object.freeze(
  PROJECT_JOURNEY_STEPS.reduce(
    (acc, step) => ({ ...acc, [step]: 0 }),
    {} as Record<ProjectJourneyStep, number>,
  ),
);

export async function getTracerHealthSnapshot(): Promise<TracerHealthSnapshot> {
  if (!process.env.DATABASE_URL) {
    return {
      tracerHealthAvailable: false,
      compositeTalentPoolSize: 0,
      compositeTalentPoolSeeded: false,
      projectJourneyCount: 0,
      projectJourneyCountByStep: { ...EMPTY_STEP_COUNTS },
      latestMigration: null,
      producerDeterministicHealthy: producerDeterministicProbe(),
    };
  }

  const db = getDb();

  const [compositeCount, journeyRows, latestMigration] = await Promise.all([
    safeCompositePoolCount(db),
    safeJourneyRows(db),
    safeLatestMigration(db),
  ]);

  const countsByStep: Record<ProjectJourneyStep, number> = {
    ...EMPTY_STEP_COUNTS,
  };
  let totalJourneys = 0;
  for (const row of journeyRows) {
    if (isJourneyStep(row.step)) {
      countsByStep[row.step] = (countsByStep[row.step] ?? 0) + row._count;
      totalJourneys += row._count;
    }
  }

  return {
    tracerHealthAvailable: true,
    compositeTalentPoolSize: compositeCount,
    compositeTalentPoolSeeded:
      compositeCount >= COMPOSITE_POOL_SEEDED_THRESHOLD,
    projectJourneyCount: totalJourneys,
    projectJourneyCountByStep: countsByStep,
    latestMigration,
    producerDeterministicHealthy: producerDeterministicProbe(),
  };
}

async function safeCompositePoolCount(
  db: ReturnType<typeof getDb>,
): Promise<number> {
  try {
    return await db.person.count({ where: { source: "DEMO_COMPOSITE" } });
  } catch (error) {
    logServerError("tracerHealth.compositePoolCount", error);
    return 0;
  }
}

async function safeJourneyRows(
  db: ReturnType<typeof getDb>,
): Promise<Array<{ step: string; _count: number }>> {
  try {
    const grouped = await db.projectJourney.groupBy({
      by: ["step"],
      _count: { _all: true },
    });
    return grouped.map((row) => ({ step: row.step, _count: row._count._all }));
  } catch (error) {
    logServerError("tracerHealth.journeyRows", error);
    return [];
  }
}

async function safeLatestMigration(
  db: ReturnType<typeof getDb>,
): Promise<TracerHealthSnapshot["latestMigration"]> {
  try {
    const rows = await db.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null }>
    >`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    const first = rows[0];
    if (!first || !first.finished_at) return null;
    return {
      name: first.migration_name,
      appliedAt: first.finished_at.toISOString(),
    };
  } catch (error) {
    logServerError("tracerHealth.latestMigration", error);
    return null;
  }
}

/**
 * Run the deterministic producer surface on a synthetic input. If
 * `buildProjectUnderstanding` or `generateRoleMap` throws, an
 * upstream code path has broken the producer contract — surface
 * `producerDeterministicHealthy: false` so ops can investigate
 * before users hit the /crew page.
 *
 * Pure: no DB. Safe to call on every health check.
 */
function producerDeterministicProbe(): boolean {
  try {
    const understanding = buildProjectUnderstanding({
      project: {
        title: "Health probe brief",
        description: "Synthetic brief used by /api/health to smoke-test the producer.",
        city: "Los Angeles",
        targetDate: "July",
        budgetRange: "$10k",
        audience: "150 people",
        fandoms: ["anime"],
      },
    });
    const roleMap = generateRoleMap({
      ...understanding,
      sourceKind: "organizer_project",
    });
    return roleMap.requiredRoles.length > 0;
  } catch (error) {
    logServerError("tracerHealth.producerProbe", error);
    return false;
  }
}

function isJourneyStep(value: string): value is ProjectJourneyStep {
  return (PROJECT_JOURNEY_STEPS as readonly string[]).includes(value);
}
