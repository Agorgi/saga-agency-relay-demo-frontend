import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  ensureSessionPerson,
  upsertSessionIdentitySignals,
  upsertSessionIdentitySignalsFromExtracted,
} from "@/lib/sessionPersonStore";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await db.webSession.deleteMany();
    await db.person.deleteMany();
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

test("ensureSessionPerson creates a Person and binds it to the session on first call", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    assert.equal(session.personId, null);

    const personId = await ensureSessionPerson(session.id);
    assert.ok(personId);

    // Session was bound.
    const updated = await db.webSession.findUnique({
      where: { id: session.id },
      select: { personId: true },
    });
    assert.equal(updated?.personId, personId);

    // Person row exists with the expected shape.
    const person = await db.person.findUnique({ where: { id: personId } });
    assert.ok(person);
    assert.equal(person?.source, "APP");
    assert.equal(person?.phone, null);
    assert.equal(person?.email, null);
    assert.deepEqual(person?.fandoms, []);
    assert.deepEqual(person?.interests, []);
  });
});

test("ensureSessionPerson is idempotent — second call returns the same Person", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const first = await ensureSessionPerson(session.id);
    const second = await ensureSessionPerson(session.id);
    assert.equal(first, second);

    // Exactly one Person row created.
    const count = await db.person.count();
    assert.equal(count, 1);
  });
});

test("upsertSessionIdentitySignals writes the captured fandom to the session's Person", async () => {
  // The user's stated requirement: when a user mentions
  // 'love and deepspace' in any chat turn, it must persist on
  // their profile so we can pair them with other fans.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    const result = await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "I want to throw a Love and Deepspace formal ball.",
    });

    assert.ok(result.personId);
    assert.deepEqual(result.fandomsAdded, ["Love and Deepspace"]);

    const person = await db.person.findUnique({
      where: { id: result.personId },
    });
    assert.deepEqual(person?.fandoms, ["Love and Deepspace"]);
  });
});

test("upsertSessionIdentitySignals accumulates fandoms across multiple chat turns", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "Big anime fan.",
    });
    await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "Also K-pop and Love and Deepspace.",
    });

    const refreshed = await db.webSession.findUnique({
      where: { id: session.id },
      select: { personId: true },
    });
    const person = await db.person.findUnique({
      where: { id: refreshed?.personId ?? "" },
    });
    const fandomSet = new Set(person?.fandoms ?? []);
    assert.ok(fandomSet.has("anime"));
    assert.ok(fandomSet.has("K-pop"));
    assert.ok(fandomSet.has("Love and Deepspace"));
  });
});

test("upsertSessionIdentitySignals does not double-write when a fandom is re-mentioned", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "I love anime.",
    });
    const firstWrite = await db.person.findFirst();
    const firstUpdated = firstWrite?.updatedAt;

    // Wait briefly so updatedAt would change if the row were rewritten.
    await new Promise((r) => setTimeout(r, 25));

    const result = await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "Still talking about anime.",
    });
    assert.deepEqual(result.fandomsAdded, [], "no new fandom should be added");

    const refreshed = await db.person.findFirst();
    assert.equal(
      refreshed?.updatedAt?.getTime(),
      firstUpdated?.getTime(),
      "Person row should not be touched when no new signals to add",
    );
  });
});

test("upsertSessionIdentitySignals does not create a Person when the message has no recognized signals", async () => {
  // Don't pollute the DB with empty Person rows on every chat turn.
  // The Person should only be created when there's something worth
  // storing.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const result = await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "hello",
    });
    assert.equal(result.personId, "");
    assert.equal(await db.person.count(), 0);
    const refreshed = await db.webSession.findUnique({
      where: { id: session.id },
      select: { personId: true },
    });
    assert.equal(refreshed?.personId, null);
  });
});

test("upsertSessionIdentitySignals separates fandoms from interests on the Person row", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "I run anime nightlife events with rooftop pop-ups",
    });
    const person = await db.person.findFirst();
    assert.ok(person);
    assert.ok(person.fandoms.includes("anime"));
    assert.ok(person.interests.includes("nightlife"));
    assert.ok(person.interests.includes("rooftop venues"));
    assert.ok(person.interests.includes("pop-ups"));
    // No interest words leaked into fandoms
    assert.equal(
      person.fandoms.some((f) => /nightlife|rooftop|pop[- ]?ups?/i.test(f)),
      false,
    );
  });
});

// PR #67: the LLM path. The LLM returns structured fandoms/interests
// in its `extractedSignals` payload; the chat route hands them off
// here without re-running regex extraction.

test("upsertSessionIdentitySignalsFromExtracted writes LLM-supplied fandoms to Person", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    // Imagine the LLM extracted a fandom the regex bank doesn't know
    // about yet — the whole point of LLM-primary extraction is that
    // these still land in Person.fandoms.
    const result = await upsertSessionIdentitySignalsFromExtracted({
      sessionId: session.id,
      signals: {
        fandoms: ["Chainsaw Man", "Spy x Family"],
        interests: ["anime conventions"],
      },
    });

    assert.ok(result.personId);
    assert.deepEqual(result.fandomsAdded.sort(), ["Chainsaw Man", "Spy x Family"]);
    assert.deepEqual(result.interestsAdded, ["anime conventions"]);

    const person = await db.person.findUnique({
      where: { id: result.personId },
    });
    assert.ok(person);
    assert.ok(person.fandoms.includes("Chainsaw Man"));
    assert.ok(person.fandoms.includes("Spy x Family"));
    assert.ok(person.interests.includes("anime conventions"));
  });
});

test("upsertSessionIdentitySignalsFromExtracted merges on top of regex output without duplicating", async () => {
  // Mirrors the production chat flow: the regex pass writes first
  // (safety net), then the LLM pass adds whatever it caught that
  // the regex missed. Both should converge to a clean dedup'd row.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    await upsertSessionIdentitySignals({
      sessionId: session.id,
      message: "I'm a Love and Deepspace fan from Brooklyn.",
    });

    // The LLM also caught Love and Deepspace AND an additional new
    // fandom the regex doesn't have a pattern for yet.
    await upsertSessionIdentitySignalsFromExtracted({
      sessionId: session.id,
      signals: {
        fandoms: ["Love and Deepspace", "Tears of the Kingdom"],
        interests: null,
      },
    });

    const person = await db.person.findFirst();
    assert.ok(person);
    // Love and Deepspace landed exactly once.
    const lndCount = person.fandoms.filter(
      (f) => f.toLowerCase() === "love and deepspace",
    ).length;
    assert.equal(lndCount, 1);
    assert.ok(person.fandoms.includes("Tears of the Kingdom"));
  });
});

test("upsertSessionIdentitySignalsFromExtracted is a no-op when both lists are empty", async () => {
  // Chat route calls this unconditionally on every LLM reply; when
  // the LLM didn't extract anything, we should not create or touch
  // a Person row.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    const result = await upsertSessionIdentitySignalsFromExtracted({
      sessionId: session.id,
      signals: { fandoms: [], interests: [] },
    });

    assert.equal(result.personId, "");
    assert.deepEqual(result.fandomsAdded, []);
    assert.deepEqual(result.interestsAdded, []);
    assert.equal(await db.person.count(), 0);
  });
});

test("upsertSessionIdentitySignalsFromExtracted tolerates null and undefined input arrays", async () => {
  // LLM contract has fandoms/interests as `string[] | null` — the
  // route normalizes nullables to empty arrays before calling.
  // Validating directly that null/undefined still work end-to-end.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    const result = await upsertSessionIdentitySignalsFromExtracted({
      sessionId: session.id,
      signals: {
        fandoms: null,
        interests: undefined,
      },
    });

    assert.equal(result.personId, "");
    assert.equal(await db.person.count(), 0);
  });
});

test("upsertSessionIdentitySignalsFromExtracted filters empty/whitespace strings", async () => {
  // The LLM is told to leave fields null when there's nothing to
  // extract, but defending against an empty-string slip is cheap.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    const result = await upsertSessionIdentitySignalsFromExtracted({
      sessionId: session.id,
      signals: {
        fandoms: ["", "   ", "BTS"],
        interests: ["", "rooftop venues"],
      },
    });

    assert.deepEqual(result.fandomsAdded, ["BTS"]);
    assert.deepEqual(result.interestsAdded, ["rooftop venues"]);
  });
});
