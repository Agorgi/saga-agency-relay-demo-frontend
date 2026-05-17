/**
 * Project journey service — framework-agnostic state machine.
 *
 * No Next.js imports. Pure async functions over Prisma + the types in
 * ./types. Liftable into `apps/app-server` in Phase 2 with only import-path
 * changes.
 *
 * Public surface:
 *   - createJourney(projectId, prisma?) — initial 'intake' state
 *   - getJourney(projectId, prisma?) — current state or null
 *   - getOrCreateJourney(projectId, prisma?) — idempotent fetch+create
 *   - advanceJourney(projectId, intent, prisma?) — validated transition
 *   - computePrimaryAction(step, projectId) — pure helper, no I/O
 *
 * The state-machine table lives in ./types (JOURNEY_TRANSITIONS).
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { getDb } from "@/sms-engine/db";
import {
  type ActionDescriptor,
  type AdvanceIntent,
  type Blocker,
  type ProjectJourney,
  type ProjectJourneyStep,
  findAllowedTransition,
  JourneyTransitionError,
} from "@/lib/journey/types";

type DbClient = PrismaClient | Prisma.TransactionClient;

function client(override?: DbClient): DbClient {
  return override || getDb();
}

/**
 * Compute the canonical primary action for a given step.
 *
 * This is the step-default action; richer per-project logic (e.g. "approve at
 * least 1 per core role") arrives in PR #4 when Sagasan integrates with the
 * journey. Pages should always render whatever `journey.primaryAction` says,
 * not compute their own — that's the whole point of the journey owning the UI
 * state contract.
 */
export function computePrimaryAction(
  step: ProjectJourneyStep,
  projectId: string,
): ActionDescriptor {
  switch (step) {
    case "intake":
      return {
        label: "Keep telling me about it",
        intent: "submit_chat",
        enabled: true,
      };
    case "brief_ready":
      return {
        label: "Build my crew",
        intent: "navigate",
        href: `/projects/${projectId}/crew`,
        enabled: true,
      };
    case "crew_reviewing":
      return {
        label: "Approve at least 1 candidate per core role",
        intent: "approve",
        href: `/projects/${projectId}/crew`,
        enabled: false,
        blockedReason:
          "Approve at least one candidate on every core role to prepare outreach.",
      };
    case "outreach_prep":
      return {
        label: "Review outreach drafts",
        intent: "navigate",
        href: `/projects/${projectId}/outreach`,
        enabled: true,
      };
    case "outreach_awaiting_send":
      return {
        label: "Send outreach",
        intent: "approve",
        enabled: false,
        blockedReason:
          "Outreach is held until A2P approval and the Twilio kill switch are lifted.",
      };
    case "outreach_sent":
      return {
        label: "View sent outreach",
        intent: "navigate",
        href: `/projects/${projectId}/outreach`,
        enabled: true,
      };
    case "archived":
      return {
        label: "Project archived",
        intent: "navigate",
        enabled: false,
      };
  }
}

function emptyBlockers(): Blocker[] {
  return [];
}

/**
 * Create an initial journey row for a project at the 'intake' step.
 * Idempotent at the database level via the unique index on projectId — callers
 * should prefer `getOrCreateJourney` when they aren't sure whether one exists.
 */
export async function createJourney(
  projectId: string,
  db?: DbClient,
): Promise<ProjectJourney> {
  const step: ProjectJourneyStep = "intake";
  const row = await client(db).projectJourney.create({
    data: {
      projectId,
      step,
      primaryAction: computePrimaryAction(step, projectId),
      blockers: emptyBlockers(),
    },
  });
  return mapRow(row);
}

/**
 * Read the current journey for a project, or null if none exists.
 */
export async function getJourney(
  projectId: string,
  db?: DbClient,
): Promise<ProjectJourney | null> {
  const row = await client(db).projectJourney.findUnique({
    where: { projectId },
  });
  return row ? mapRow(row) : null;
}

/**
 * Get the journey if it exists, otherwise create one at 'intake'.
 * Safe to call from any code path that needs a journey to read.
 */
export async function getOrCreateJourney(
  projectId: string,
  db?: DbClient,
): Promise<ProjectJourney> {
  const existing = await getJourney(projectId, db);
  if (existing) return existing;
  return createJourney(projectId, db);
}

/**
 * Advance the journey for a project. Throws `JourneyTransitionError` if the
 * intent is not legal from the current step. The caller (Sagasan, an API
 * route, a background job) is responsible for catching and surfacing errors.
 *
 * Returns the updated journey.
 */
export async function advanceJourney(
  projectId: string,
  intent: AdvanceIntent,
  db?: DbClient,
): Promise<ProjectJourney> {
  const c = client(db);
  const current = await c.projectJourney.findUnique({
    where: { projectId },
  });
  if (!current) {
    throw new JourneyTransitionError(
      "intake",
      intent,
      `no journey exists for projectId="${projectId}"`,
    );
  }

  const from = current.step as ProjectJourneyStep;
  const to = findAllowedTransition(from, intent);
  if (!to) {
    throw new JourneyTransitionError(
      from,
      intent,
      "transition not in JOURNEY_TRANSITIONS table",
    );
  }

  if (to === from) {
    return mapRow(current);
  }

  const row = await c.projectJourney.update({
    where: { projectId },
    data: {
      step: to,
      primaryAction: computePrimaryAction(to, projectId),
      blockers: emptyBlockers(),
      lastTransition: new Date(),
    },
  });
  return mapRow(row);
}

// Internal: Prisma row → public type (handles JSON casts and date narrowing).
function mapRow(row: {
  id: string;
  projectId: string;
  step: string;
  primaryAction: unknown;
  blockers: unknown;
  lastTransition: Date;
  createdAt: Date;
  updatedAt: Date;
}): ProjectJourney {
  return {
    id: row.id,
    projectId: row.projectId,
    step: row.step as ProjectJourneyStep,
    primaryAction: row.primaryAction as ActionDescriptor,
    blockers: Array.isArray(row.blockers) ? (row.blockers as Blocker[]) : [],
    lastTransition: row.lastTransition,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
