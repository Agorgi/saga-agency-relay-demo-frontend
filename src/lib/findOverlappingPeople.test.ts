import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { findPeopleWithOverlappingFandoms } from "@/lib/findOverlappingPeople";

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

test("findPeopleWithOverlappingFandoms returns an empty list when the seed has no fandoms", async () => {
  await withFreshDb(async (db) => {
    const seed = await db.person.create({
      data: { name: "Empty Seed", source: "APP", fandoms: [], interests: [] },
    });
    await db.person.create({
      data: {
        name: "Other Fan",
        source: "APP",
        fandoms: ["anime", "K-pop"],
      },
    });

    const matches = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
    });
    assert.deepEqual(matches, []);
  });
});

test("findPeopleWithOverlappingFandoms returns an empty list when the seed does not exist", async () => {
  await withFreshDb(async () => {
    const matches = await findPeopleWithOverlappingFandoms({
      personId: "cm0nonexistentperson",
    });
    assert.deepEqual(matches, []);
  });
});

test("findPeopleWithOverlappingFandoms finds people who share at least one fandom", async () => {
  await withFreshDb(async (db) => {
    const seed = await db.person.create({
      data: {
        name: "Seed Host",
        source: "APP",
        fandoms: ["Love and Deepspace", "anime"],
      },
    });
    const matching = await db.person.create({
      data: {
        name: "Anime Illustrator",
        source: "APP",
        fandoms: ["anime", "cosplay"],
      },
    });
    const nonMatching = await db.person.create({
      data: {
        name: "Unrelated",
        source: "APP",
        fandoms: ["EDM", "techno"],
      },
    });

    const matches = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
    });
    const matchedIds = matches.map((m) => m.personId);
    assert.ok(
      matchedIds.includes(matching.id),
      "The anime fan should appear in matches",
    );
    assert.ok(
      !matchedIds.includes(nonMatching.id),
      "Non-overlapping people must not appear",
    );
    assert.ok(
      !matchedIds.includes(seed.id),
      "The seed itself must not match itself",
    );

    const animeMatch = matches.find((m) => m.personId === matching.id);
    assert.ok(animeMatch);
    assert.deepEqual(animeMatch?.fandomOverlap, ["anime"]);
    assert.equal(animeMatch?.overlapCount, 1);
  });
});

test("findPeopleWithOverlappingFandoms orders matches by overlap size descending", async () => {
  await withFreshDb(async (db) => {
    const seed = await db.person.create({
      data: {
        name: "Seed",
        source: "APP",
        fandoms: ["anime", "K-pop", "Love and Deepspace"],
      },
    });
    const weakMatch = await db.person.create({
      data: { name: "Weak", source: "APP", fandoms: ["anime"] },
    });
    const strongMatch = await db.person.create({
      data: {
        name: "Strong",
        source: "APP",
        fandoms: ["anime", "K-pop", "Love and Deepspace"],
      },
    });
    const midMatch = await db.person.create({
      data: { name: "Mid", source: "APP", fandoms: ["anime", "K-pop"] },
    });

    const matches = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
    });

    assert.equal(matches.length, 3);
    assert.equal(matches[0]?.personId, strongMatch.id);
    assert.equal(matches[0]?.overlapCount, 3);
    assert.equal(matches[1]?.personId, midMatch.id);
    assert.equal(matches[1]?.overlapCount, 2);
    assert.equal(matches[2]?.personId, weakMatch.id);
    assert.equal(matches[2]?.overlapCount, 1);
  });
});

test("findPeopleWithOverlappingFandoms respects the limit parameter", async () => {
  await withFreshDb(async (db) => {
    const seed = await db.person.create({
      data: { name: "Seed", source: "APP", fandoms: ["anime"] },
    });
    for (let i = 0; i < 5; i += 1) {
      await db.person.create({
        data: {
          name: `Fan ${i}`,
          source: "APP",
          fandoms: ["anime"],
        },
      });
    }
    const matches = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
      limit: 2,
    });
    assert.equal(matches.length, 2);
  });
});

test("findPeopleWithOverlappingFandoms can exclude composite sources", async () => {
  // Realistic use case: the "people you might like" surface should
  // only show real users, not the seeded composite talent pool.
  await withFreshDb(async (db) => {
    const seed = await db.person.create({
      data: { name: "Seed", source: "APP", fandoms: ["anime"] },
    });
    const realFan = await db.person.create({
      data: { name: "Real Fan", source: "APP", fandoms: ["anime"] },
    });
    const composite = await db.person.create({
      data: {
        name: "Composite Fan",
        source: "DEMO_COMPOSITE",
        fandoms: ["anime"],
      },
    });

    const withCom = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
    });
    const withComIds = withCom.map((m) => m.personId);
    assert.ok(withComIds.includes(realFan.id));
    assert.ok(withComIds.includes(composite.id));

    const withoutCom = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
      excludeSources: ["DEMO_COMPOSITE"],
    });
    const withoutComIds = withoutCom.map((m) => m.personId);
    assert.ok(withoutComIds.includes(realFan.id));
    assert.ok(!withoutComIds.includes(composite.id));
  });
});

test("findPeopleWithOverlappingFandoms returns the actual overlapping fandoms per match", async () => {
  // Verifies the intersection columns are populated correctly —
  // critical for the producer's matching-reason text and for the
  // "people you might like" UI that displays shared fandoms.
  await withFreshDb(async (db) => {
    const seed = await db.person.create({
      data: {
        name: "Seed",
        source: "APP",
        fandoms: ["Love and Deepspace", "Genshin Impact", "K-pop"],
      },
    });
    const partialMatch = await db.person.create({
      data: {
        name: "Partial",
        source: "APP",
        fandoms: ["Love and Deepspace", "K-pop", "BTS"],
      },
    });

    const matches = await findPeopleWithOverlappingFandoms({
      personId: seed.id,
    });
    const partial = matches.find((m) => m.personId === partialMatch.id);
    assert.ok(partial);
    const overlapSet = new Set(partial!.fandomOverlap);
    assert.ok(overlapSet.has("Love and Deepspace"));
    assert.ok(overlapSet.has("K-pop"));
    assert.ok(!overlapSet.has("BTS"), "BTS not in seed; must not appear in overlap");
    assert.ok(
      !overlapSet.has("Genshin Impact"),
      "Genshin not in match; must not appear in overlap",
    );
  });
});
