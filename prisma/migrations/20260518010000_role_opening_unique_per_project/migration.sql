-- Ensure RoleOpening is unique per (projectId, roleType).
--
-- The application's generateCrewForProject uses a count-then-create
-- pattern that races under concurrent /crew page loads. Without a
-- schema-level guarantee, two browser tabs (or a double-click) on a
-- fresh project can each create the full role set, doubling the
-- role list and the candidate recommendations underneath.
--
-- Step 1: dedupe any existing duplicates that landed before the
-- constraint. Keep the oldest row per (projectId, roleType) — the
-- first one written is the canonical one; later duplicates are
-- collateral from the race. Cascading deletes on the Opportunity /
-- CandidateRecommendation relations clean up downstream rows.
DELETE FROM "RoleOpening"
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "projectId", "roleType"
        ORDER BY "createdAt" ASC, id ASC
      ) AS row_num
    FROM "RoleOpening"
  ) ranked
  WHERE row_num > 1
);

-- Step 2: add the constraint. CREATE UNIQUE INDEX is concurrency-safe
-- (does NOT take a long write lock) but Prisma's @@unique generates
-- ALTER TABLE ADD CONSTRAINT under the hood, which is fine for small
-- tables but takes an ACCESS EXCLUSIVE lock. RoleOpening is small
-- enough today that the lock is sub-second.
CREATE UNIQUE INDEX "RoleOpening_projectId_roleType_key"
  ON "RoleOpening"("projectId", "roleType");
