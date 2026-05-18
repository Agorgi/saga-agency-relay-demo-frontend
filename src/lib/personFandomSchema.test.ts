/**
 * Smoke test for the PR #63 schema migration. Confirms:
 *   - `fandoms` and `interests` columns exist on Person and default
 *     to empty arrays
 *   - Both can be written to and read back as String[]
 *   - Postgres array-overlap operator (`&&`) returns the expected
 *     rows — the operator the cross-fandom matching helper in PR #68
 *     will rely on
 *
 * Pure schema verification; no application code uses these fields
 * yet. PR #64 wires the extractors to populate them.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await db.person.deleteMany();
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

test("Person.fandoms and Person.interests default to empty arrays", async () => {
  await withFreshDb(async (db) => {
    const person = await db.person.create({
      data: { name: "Test", source: "ADMIN" },
    });
    assert.deepEqual(person.fandoms, []);
    assert.deepEqual(person.interests, []);
  });
});

test("Person.fandoms and Person.interests accept arbitrary string arrays", async () => {
  await withFreshDb(async (db) => {
    const person = await db.person.create({
      data: {
        name: "Fandom Test",
        source: "ADMIN",
        fandoms: ["Love and Deepspace", "anime", "K-pop"],
        interests: ["nightlife", "rooftop venues"],
      },
    });
    assert.deepEqual(
      person.fandoms.sort(),
      ["K-pop", "Love and Deepspace", "anime"].sort(),
    );
    assert.deepEqual(person.interests.sort(), ["nightlife", "rooftop venues"].sort());

    // Round-trip — re-read from DB by id.
    const re = await db.person.findUnique({ where: { id: person.id } });
    assert.deepEqual(re?.fandoms.sort(), person.fandoms.sort());
    assert.deepEqual(re?.interests.sort(), person.interests.sort());
  });
});

test("Person fandom-overlap query (hasSome) returns rows whose fandoms intersect the supplied list", async () => {
  // The cross-fandom matching helper in PR #68 will lean on
  // Prisma's `hasSome` (compiles to Postgres array-overlap `&&`,
  // hits the GIN index added in this migration). Verify the
  // semantics work as expected on real rows.
  await withFreshDb(async (db) => {
    const animeCosplay = await db.person.create({
      data: {
        name: "Anime + Cosplay Fan",
        source: "DEMO_COMPOSITE",
        fandoms: ["anime", "cosplay"],
      },
    });
    const lovedeep = await db.person.create({
      data: {
        name: "Love and Deepspace Fan",
        source: "DEMO_COMPOSITE",
        fandoms: ["Love and Deepspace"],
      },
    });
    const noFandom = await db.person.create({
      data: { name: "No Fandom", source: "DEMO_COMPOSITE" },
    });

    // Query: "anyone who shares any of {anime, K-pop}" — should
    // pick up the anime+cosplay row and skip the others.
    const overlap = await db.person.findMany({
      where: { fandoms: { hasSome: ["anime", "K-pop"] } },
      select: { id: true },
    });
    const overlapIds = overlap.map((r) => r.id).sort();
    assert.deepEqual(overlapIds, [animeCosplay.id].sort());

    // Query: "anyone who shares any of {Love and Deepspace}"
    const lovedeepMatches = await db.person.findMany({
      where: { fandoms: { hasSome: ["Love and Deepspace"] } },
      select: { id: true },
    });
    assert.deepEqual(
      lovedeepMatches.map((r) => r.id),
      [lovedeep.id],
    );

    // Sanity: noFandom person never surfaces under any overlap query.
    const noFandomMatches = await db.person.findMany({
      where: { fandoms: { hasSome: ["anime", "K-pop", "Love and Deepspace"] } },
      select: { id: true },
    });
    assert.ok(!noFandomMatches.some((r) => r.id === noFandom.id));
  });
});
