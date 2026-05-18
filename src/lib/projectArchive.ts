/**
 * Archive a Project — the "start over" primitive for the tracer.
 *
 * Today a chat session that wants to start fresh (typo brief, wrong idea,
 * change of plans) has nowhere to go: `WebSession.projectId` stays bound
 * to the existing Project and `upsertProjectFromBrief` keeps updating
 * that same row on every new chat turn. Archiving solves this by:
 *
 *   1. Advancing `ProjectJourney.step` to `archived` via the journey
 *      state machine (which allows the transition from any non-archived
 *      step — see JOURNEY_TRANSITIONS in src/lib/journey/types.ts).
 *   2. Clearing `WebSession.projectId` for every session that currently
 *      points at the archived Project. The next chat turn from any of
 *      those sessions will see `session.projectId === null` and create
 *      a fresh Project — clean start.
 *
 * Both happen inside a single Prisma transaction so a network blip
 * between steps leaves the DB in a consistent state (either both
 * land or neither does).
 *
 * Framework-agnostic — no Next.js imports. Liftable into
 * `apps/app-server` during Phase 2 backend convergence with only
 * import-path changes.
 *
 * The Project row itself is NOT deleted. The brief, roles, candidates,
 * and outreach drafts all stay queryable for audit. A future
 * "Unarchive" feature can revert the journey state — the data is still
 * there.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  advanceJourney,
  getOrCreateJourney,
} from "@/lib/journey/service";
import type { ProjectJourney } from "@/lib/journey/types";
import { getDb } from "@/sms-engine/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ArchiveProjectResult =
  | { ok: true; journey: ProjectJourney; sessionsUnbound: number }
  | { ok: false; reason: "project_not_found" | "already_archived" };

/**
 * Archive the project. Idempotent at the "already archived" boundary —
 * a second call returns `{ ok: false, reason: "already_archived" }`
 * without touching the DB. Use the result discriminant to decide what
 * to render in the API response (the journey row is still available
 * for the OK case).
 */
export async function archiveProject(
  projectId: string,
  db?: DbClient,
): Promise<ArchiveProjectResult> {
  const client = db || getDb();

  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, reason: "project_not_found" };

  const journey = await getOrCreateJourney(projectId, client);
  if (journey.step === "archived") {
    return { ok: false, reason: "already_archived" };
  }

  // Single transaction: advance journey + unbind sessions. If either
  // fails the whole thing rolls back. We pass the transaction client
  // through to advanceJourney so its update participates in the same
  // transaction.
  if ("$transaction" in client) {
    return await (client as PrismaClient).$transaction(async (tx) => {
      const updatedJourney = await advanceJourney(projectId, "archive", tx);
      const unbindResult = await tx.webSession.updateMany({
        where: { projectId },
        data: { projectId: null },
      });
      return {
        ok: true,
        journey: updatedJourney,
        sessionsUnbound: unbindResult.count,
      };
    });
  }

  // Already inside a transaction (caller passed a TransactionClient).
  const updatedJourney = await advanceJourney(projectId, "archive", client);
  const unbindResult = await client.webSession.updateMany({
    where: { projectId },
    data: { projectId: null },
  });
  return {
    ok: true,
    journey: updatedJourney,
    sessionsUnbound: unbindResult.count,
  };
}
