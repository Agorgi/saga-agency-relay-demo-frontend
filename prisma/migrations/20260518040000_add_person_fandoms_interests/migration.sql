-- Identity-graph foundation (PR #63).
--
-- Add `fandoms` and `interests` columns to Person plus GIN indexes
-- so cross-matching queries on array-overlap (`&&`) and contains
-- (`@>`) stay fast as the pool grows. Existing rows light up with
-- empty arrays — extractors populate them per session.
--
-- Both fields apply to every persona (host / creative / venue /
-- fan), not just creators. The intent is cross-pollination: a host
-- who mentions "Love and Deepspace" in their brief surfaces to
-- other Love-and-Deepspace fans, etc. CreatorProfile.fandoms still
-- exists as a creator-specific override that admins can curate;
-- Person.fandoms is the source-of-truth captured from chat across
-- the whole app.

ALTER TABLE "Person"
  ADD COLUMN "fandoms" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "interests" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX "Person_fandoms_idx" ON "Person" USING GIN ("fandoms");
CREATE INDEX "Person_interests_idx" ON "Person" USING GIN ("interests");
