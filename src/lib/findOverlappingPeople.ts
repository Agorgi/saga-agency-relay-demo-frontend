/**
 * Cross-fandom matching helper (PR #68).
 *
 * Given a Person, find other Persons whose `fandoms` array overlaps
 * with theirs. This is the foundation query of the identity-graph
 * promise from PRs #63–67: a host who mentioned "Love and Deepspace"
 * in their brief, an illustrator who listed "anime" in their intake,
 * and a fan who said "K-pop nights" should all see each other as
 * potential collaborators.
 *
 * Uses Postgres array-overlap (`&&`) directly via `$queryRaw` so the
 * GIN index on `Person.fandoms` is hit. Prisma's `hasSome` operator
 * would also generate `&&` but the raw path lets us return the
 * actual overlapping fandoms per row in one round-trip — the
 * producer's candidate-scoring step in
 * `src/sms-engine/producer/candidateRecommendations.ts` and any
 * future "people you might like" surface both need to display the
 * overlap, not just the count.
 *
 * Framework-agnostic — Prisma client only, no Next.js imports.
 * Liftable into `apps/app-server` during Phase 2 convergence.
 */

import { Prisma, type PersonSource, type PrismaClient } from "@prisma/client";
import { getDb } from "@/sms-engine/db";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type OverlappingPersonMatch = {
  personId: string;
  displayName: string | null;
  fandomOverlap: string[];
  overlapCount: number;
  source: PersonSource;
  city: string | null;
};

/**
 * Find all Persons (excluding `personId`) whose `fandoms` overlap
 * with the input Person's `fandoms`. Ordered by overlap size
 * descending so the strongest matches come first.
 *
 * Returns an empty list when:
 *   - the input Person doesn't exist
 *   - the input Person has no fandoms recorded yet
 *   - no other Person has overlapping fandoms
 *
 * The `limit` cap is a defensive guard against accidental
 * fanout-to-the-whole-table queries when the pool grows. Default
 * 20 is enough for both the producer-scoring use case (top-N for
 * boost candidates) and the future "people you might like" surface.
 *
 * `excludeSources` filters out matches whose Person.source is in
 * that set. Useful for the "real users only" surface (filter out
 * DEMO_COMPOSITE rows) without changing the index strategy. Empty
 * by default — most callers want every match.
 */
export async function findPeopleWithOverlappingFandoms({
  personId,
  limit = 20,
  excludeSources = [],
  db,
}: {
  personId: string;
  limit?: number;
  excludeSources?: PersonSource[];
  db?: DbClient;
}): Promise<OverlappingPersonMatch[]> {
  const client = db || getDb();

  const seed = await client.person.findUnique({
    where: { id: personId },
    select: { fandoms: true },
  });
  if (!seed || seed.fandoms.length === 0) {
    return [];
  }

  // The intersection-via-unnest pattern is necessary because
  // Postgres has no built-in `array_intersect`. The outer WHERE
  // uses `&&` so the GIN index on Person.fandoms drives the row
  // selection; the intersection subquery only evaluates over the
  // small matched set.
  const seedFandoms = seed.fandoms;
  type Row = {
    id: string;
    name: string | null;
    source: PersonSource;
    city: string | null;
    overlap: string[];
  };

  const excludeFilter = excludeSources.length
    ? Prisma.sql`AND p."source"::text <> ALL(${excludeSources.map((s) => s.toString())}::text[])`
    : Prisma.empty;

  const rows = await client.$queryRaw<Row[]>`
    SELECT
      p.id,
      p.name,
      p."source",
      p.city,
      ARRAY(
        SELECT unnest(p.fandoms)
        INTERSECT
        SELECT unnest(${seedFandoms}::text[])
      ) AS overlap
    FROM "Person" p
    WHERE p.id <> ${personId}
      AND p.fandoms && ${seedFandoms}::text[]
      ${excludeFilter}
    ORDER BY cardinality(
      ARRAY(
        SELECT unnest(p.fandoms)
        INTERSECT
        SELECT unnest(${seedFandoms}::text[])
      )
    ) DESC, p."updatedAt" DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    personId: row.id,
    displayName: row.name,
    fandomOverlap: row.overlap,
    overlapCount: row.overlap.length,
    source: row.source,
    city: row.city,
  }));
}
