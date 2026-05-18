-- Identity anchor on WebSession (PR #64).
--
-- Adds `personId` to `WebSession` so cross-persona identity signals
-- (fandoms, interests, city) captured in chat all land on the same
-- Person row regardless of which intake surface (host / creative /
-- venue / fan) the user came in through.
--
-- Created lazily on the first identity-bearing chat turn by
-- `ensureSessionPerson` (`src/lib/sessionPersonStore.ts`). Existing
-- sessions stay with `personId = NULL` until they next chat —
-- backfill is not required because the user-visible behavior
-- (cross-fandom matching surfaces) only depends on sessions
-- with non-null personId.

ALTER TABLE "WebSession"
  ADD COLUMN "personId" TEXT;

ALTER TABLE "WebSession"
  ADD CONSTRAINT "WebSession_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "WebSession_personId_idx" ON "WebSession"("personId");
