-- Prevent duplicate non-terminal CANDIDATE_OUTREACH drafts per candidate.
--
-- The application's `upsertOutboundDraft` uses a findFirst-then-create
-- pattern: it looks for an existing draft in DRAFT / NEEDS_REVIEW /
-- BLOCKED status for the same candidateRecommendationId, updates it if
-- found, otherwise creates a new one. Concurrent calls (two browser
-- tabs hitting the candidate-review approve endpoint, a re-approval
-- racing the journey advance, etc.) can both see findFirst return null
-- and both create — leaving two non-terminal rows for the same
-- candidate. The Twilio kill switch keeps the user-visible impact
-- bounded today, but the DB shape should not permit the duplicate.
--
-- Partial unique index (Postgres-specific). The constraint:
--   * Applies ONLY to type = 'CANDIDATE_OUTREACH' rows. Other types
--     (ORGANIZER_SHORTLIST, ADMIN_MANUAL) keep their existing shape.
--   * Applies ONLY to non-terminal statuses (DRAFT, NEEDS_REVIEW,
--     BLOCKED). Once a draft moves to APPROVED, SENT, REJECTED, or
--     similar terminal states, a new non-terminal draft for the same
--     candidate is allowed — that's the established multi-history
--     pattern in upsertOutboundDraft.
--   * Treats NULL candidateRecommendationId as distinct (Postgres
--     default), so legacy admin rows without a candidate link aren't
--     affected.
--
-- Step 1: dedup any pre-existing duplicates. For each candidate +
-- non-terminal status combination with more than one row, keep the
-- one with the newest updatedAt and delete the rest. Cascading
-- deletes on the draft's relations don't matter — OutboundDraft is
-- a leaf in the model graph.
DELETE FROM "OutboundDraft"
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "candidateRecommendationId"
        ORDER BY "updatedAt" DESC, id DESC
      ) AS row_num
    FROM "OutboundDraft"
    WHERE
      "type" = 'CANDIDATE_OUTREACH'
      AND "candidateRecommendationId" IS NOT NULL
      AND "status" IN ('DRAFT', 'NEEDS_REVIEW', 'BLOCKED')
  ) ranked
  WHERE row_num > 1
);

-- Step 2: add the partial unique. CREATE UNIQUE INDEX is online
-- (no long write lock) and the predicate keeps the constraint
-- scoped to exactly the rows the application's findFirst path is
-- supposed to collapse.
CREATE UNIQUE INDEX "OutboundDraft_candidate_outreach_active_unique"
  ON "OutboundDraft"("candidateRecommendationId")
  WHERE
    "type" = 'CANDIDATE_OUTREACH'
    AND "candidateRecommendationId" IS NOT NULL
    AND "status" IN ('DRAFT', 'NEEDS_REVIEW', 'BLOCKED');
