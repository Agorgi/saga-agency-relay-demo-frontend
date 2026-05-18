/**
 * Session ↔ Person identity store (PR #64).
 *
 * Every cookie session gets a `Person` row attached the first time
 * its user says something identity-bearing. The Person collects
 * fandoms + interests across every chat turn from then on,
 * regardless of which persona's intake produced them. That row is
 * what the cross-fandom matching helper (PR #68) queries against.
 *
 * Why on Person (not on WebSession directly): WebSession lifetimes
 * are short (cookie expiry, browser switches, TTL cleanup from PR #61).
 * Person rows are persistent identity anchors that survive session
 * churn — the fandom graph keeps growing even when sessions cycle.
 *
 * Framework-agnostic — Prisma client only, no Next.js imports.
 * Liftable into `apps/app-server` during Phase 2 convergence.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { getDb } from "@/sms-engine/db";
import {
  emptyIdentitySignals,
  extractIdentitySignals,
  mergeIdentitySignals,
  type IdentitySignals,
} from "@/lib/identitySignals";

type DbClient = PrismaClient | Prisma.TransactionClient;

const SESSION_PERSON_NAME_PREFIX = "[session]";

/**
 * Ensure the session has a `personId`. Returns the Person id whether
 * we found one or created it. Creating uses `source = APP` (the
 * canonical "came in through the web app" source) and an
 * implicit-name placeholder; PII-bearing fields (phone, email, name)
 * stay null until the user provides them explicitly.
 *
 * Idempotent — safe to call on every chat turn. Concurrent calls
 * (race between two browser tabs) converge: whichever Person was
 * written first becomes the session's anchor; the other is
 * abandoned (orphan) and cleaned up by Prisma's `onDelete: SetNull`
 * if it ever falls out of reference.
 */
export async function ensureSessionPerson(
  sessionId: string,
  db?: DbClient,
): Promise<string> {
  const client = db || getDb();

  const session = await client.webSession.findUnique({
    where: { id: sessionId },
    select: { personId: true },
  });
  if (session?.personId) return session.personId;

  // Create a Person + attach to the session in one round-trip.
  // Generated `name` is a transparent placeholder so admin views
  // can tell the row hasn't been claimed yet.
  const person = await client.person.create({
    data: {
      name: `${SESSION_PERSON_NAME_PREFIX} ${sessionId.slice(0, 8)}`,
      source: "APP",
      consentStatus: "IMPLIED",
    },
  });

  // Bind. If a racing writer already set personId, this update is
  // a no-op-from-the-user's-perspective (the binding stays at
  // whoever-wrote-first). updateMany with the session-id filter
  // avoids overwriting a binding set since our findUnique above.
  await client.webSession.updateMany({
    where: { id: sessionId, personId: null },
    data: { personId: person.id },
  });

  // Re-read to confirm which Person actually won the race.
  const reread = await client.webSession.findUnique({
    where: { id: sessionId },
    select: { personId: true },
  });
  return reread?.personId ?? person.id;
}

export type UpsertIdentitySignalsResult = {
  personId: string;
  fandomsAdded: string[];
  interestsAdded: string[];
};

/**
 * Capture identity signals from a single chat message into the
 * session's Person. Creates the Person row on demand
 * (ensureSessionPerson). Merges newly-extracted signals into the
 * existing fandom / interest arrays (case-insensitive dedup,
 * preserves the first-seen capitalization).
 *
 * No-op (returns `fandomsAdded: [], interestsAdded: []`) when the
 * message contains no recognized signal. Idempotent across repeated
 * calls on the same message.
 */
export async function upsertSessionIdentitySignals({
  sessionId,
  message,
  db,
}: {
  sessionId: string;
  message: string;
  db?: DbClient;
}): Promise<UpsertIdentitySignalsResult> {
  const signals = extractIdentitySignals(message);
  // Short-circuit when the message has no recognized signals AND
  // the session already has a Person — saves an unnecessary write.
  if (signals.fandoms.length === 0 && signals.interests.length === 0) {
    const client = db || getDb();
    const session = await client.webSession.findUnique({
      where: { id: sessionId },
      select: { personId: true },
    });
    if (session?.personId) {
      return {
        personId: session.personId,
        fandomsAdded: [],
        interestsAdded: [],
      };
    }
    // No signals AND no existing person — don't create an empty
    // Person row. Wait until there's something worth capturing.
    return { personId: "", fandomsAdded: [], interestsAdded: [] };
  }

  const client = db || getDb();
  const personId = await ensureSessionPerson(sessionId, client);

  // Compute the union with whatever's currently stored.
  const existing = await client.person.findUnique({
    where: { id: personId },
    select: { fandoms: true, interests: true },
  });
  const existingSignals: IdentitySignals = existing
    ? { fandoms: existing.fandoms, interests: existing.interests }
    : emptyIdentitySignals();
  const merged = mergeIdentitySignals(existingSignals, signals);

  const fandomsAdded = merged.fandoms.filter(
    (f) => !existingSignals.fandoms.some(
      (e) => e.toLowerCase() === f.toLowerCase(),
    ),
  );
  const interestsAdded = merged.interests.filter(
    (i) => !existingSignals.interests.some(
      (e) => e.toLowerCase() === i.toLowerCase(),
    ),
  );

  // Only write when something actually changed — avoids bumping
  // updatedAt + writing the same row repeatedly when a user
  // re-mentions the same fandom across multiple turns.
  if (fandomsAdded.length === 0 && interestsAdded.length === 0) {
    return { personId, fandomsAdded: [], interestsAdded: [] };
  }

  await client.person.update({
    where: { id: personId },
    data: {
      fandoms: merged.fandoms,
      interests: merged.interests,
    },
  });

  return { personId, fandomsAdded, interestsAdded };
}
