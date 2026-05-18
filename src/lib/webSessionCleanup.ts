/**
 * WebSession TTL/cleanup — bounded retention for cookie sessions.
 *
 * Background
 * ----------
 * `WebSession` rows grow on every fresh `/chat` visit and never expire.
 * `WebChatMessage` rows cascade off them. Without retention, the tables
 * grow unbounded on Neon over months — eventually a real cost / query-
 * latency issue.
 *
 * What "stale" means here
 * ----------------------
 * A session is eligible for cleanup when BOTH:
 *   1. `lastSeenAt` is older than the TTL (default 90 days), and
 *   2. The session has no active project commitment:
 *      - `projectId IS NULL` (the session never briefed, or PR #54's
 *        archive helper unbound it), OR
 *      - `projectId` is set AND the project's journey is at
 *        `archived` (defensive: in case a session was archived
 *        without going through `archiveProject`'s session-unbind
 *        step).
 *
 * What stays
 * ----------
 * Any session whose project is at `intake / brief_ready /
 * crew_reviewing / outreach_prep / outreach_awaiting_send /
 * outreach_sent` is a real user with persistent state. We don't
 * delete those — even if `lastSeenAt` is old. A design partner who
 * disappears for six months should still find their project on
 * return.
 *
 * What gets deleted
 * -----------------
 * `WebSession` rows matching both conditions. `WebChatMessage` rows
 * cascade on the session FK (`onDelete: Cascade`), so the chat
 * history follows. The `Project` row itself never gets deleted by
 * this helper — Project lifetime is independent of session lifetime.
 *
 * Defaults / configuration
 * -----------------------
 * - TTL: read from `WEB_SESSION_TTL_DAYS` env, default 90. Override
 *   per call via the function arg.
 * - Dry-run mode: callers default to dry-run. The CLI script + any
 *   future cron must pass `dryRun: false` to actually delete.
 *
 * Framework-agnostic — no Next.js imports. Liftable into
 * `apps/app-server` for Phase 2 backend convergence.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { logAudit } from "@/sms-engine/audit";
import { getDb } from "@/sms-engine/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

const DEFAULT_TTL_DAYS = 90;

export type StaleSession = {
  id: string;
  lastSeenAt: Date;
  projectId: string | null;
  projectJourneyStep: string | null;
};

export function getConfiguredTtlDays(): number {
  const raw = process.env.WEB_SESSION_TTL_DAYS?.trim();
  if (!raw) return DEFAULT_TTL_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TTL_DAYS;
  return parsed;
}

/**
 * Read-only query that returns the sessions a `cleanupStaleSessions`
 * call would target. Useful for dry-run reports and tests.
 *
 * Safe to call without DATABASE_URL — returns an empty list rather
 * than throwing, so callers don't need to guard every invocation.
 */
export async function findStaleSessions({
  ttlDays = getConfiguredTtlDays(),
  now = new Date(),
  db,
}: {
  ttlDays?: number;
  now?: Date;
  db?: DbClient;
} = {}): Promise<StaleSession[]> {
  if (!process.env.DATABASE_URL && !db) return [];

  const client = db || getDb();
  const cutoff = new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);

  const rows = await client.webSession.findMany({
    where: {
      lastSeenAt: { lt: cutoff },
      OR: [
        { projectId: null },
        { project: { projectJourney: { step: "archived" } } },
      ],
    },
    select: {
      id: true,
      lastSeenAt: true,
      projectId: true,
      project: {
        select: {
          projectJourney: {
            select: { step: true },
          },
        },
      },
    },
    orderBy: { lastSeenAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    lastSeenAt: row.lastSeenAt,
    projectId: row.projectId,
    projectJourneyStep: row.project?.projectJourney?.step ?? null,
  }));
}

export type CleanupResult = {
  ttlDays: number;
  cutoff: Date;
  scannedAt: Date;
  candidates: StaleSession[];
  deleted: number;
  dryRun: boolean;
};

/**
 * Find stale sessions and (when `dryRun: false`) delete them.
 *
 * Always returns the candidates list so the caller can log or render
 * the report regardless of mode. The audit log entry records the
 * mode + count + ttl + cutoff so a future investigator can trace
 * any deletion back to a specific run.
 */
export async function cleanupStaleSessions({
  ttlDays = getConfiguredTtlDays(),
  dryRun = true,
  now = new Date(),
  db,
}: {
  ttlDays?: number;
  dryRun?: boolean;
  now?: Date;
  db?: DbClient;
} = {}): Promise<CleanupResult> {
  const scannedAt = now;
  const cutoff = new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000);
  const candidates = await findStaleSessions({ ttlDays, now, db });

  let deleted = 0;
  if (!dryRun && candidates.length > 0) {
    const client = db || getDb();
    const result = await client.webSession.deleteMany({
      where: { id: { in: candidates.map((c) => c.id) } },
    });
    deleted = result.count;
  }

  await logAudit({
    actorType: "SYSTEM",
    action: "web_session.cleanup",
    entityType: "WebSession",
    // No single entity id — use a sentinel so audit queries can
    // group cleanup runs together.
    entityId: "web_session_cleanup_run",
    metadata: {
      dryRun,
      ttlDays,
      cutoff: cutoff.toISOString(),
      scannedAt: scannedAt.toISOString(),
      candidateCount: candidates.length,
      deletedCount: deleted,
      candidateIds: candidates.slice(0, 50).map((c) => c.id),
    },
  });

  return { ttlDays, cutoff, scannedAt, candidates, deleted, dryRun };
}
