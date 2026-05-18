import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { getTracerHealthSnapshot } from "@/lib/tracerHealth";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import { archiveProject } from "@/lib/projectArchive";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await db.outboundDraft.deleteMany();
    await db.candidateRecommendation.deleteMany();
    await db.opportunity.deleteMany();
    await db.roleOpening.deleteMany();
    await db.relationshipEdge.deleteMany();
    await db.creatorProfile.deleteMany();
    await db.webSession.deleteMany();
    await db.projectJourney.deleteMany();
    await db.project.deleteMany();
    await db.person.deleteMany();
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

const completeBrief = {
  projectIdea: "Formal ball inspired by Love and Deepspace",
  locationMarket: "Los Angeles",
  timing: "July",
  scopeFormat: "ball",
  themeVibe: "romantic",
  expectedAttendance: "150",
  lineupStatus: "one friend",
  helpNeeded: "producer",
  budget: "$15k",
  budgetStatus: null,
  inspirationStatus: "provided" as const,
  inspirationReferences: ["Love and Deepspace"],
  userRole: null,
  userIdentity: null,
  organization: null,
  socials: [],
  audience: null,
  ticketingModel: null,
  safetyFlags: [],
  urgency: null,
  desiredTalentRoles: ["Producer"],
};

test("getTracerHealthSnapshot reports tracerHealthAvailable on a configured DB even when empty", async () => {
  await withFreshDb(async () => {
    const snapshot = await getTracerHealthSnapshot();
    assert.equal(snapshot.tracerHealthAvailable, true);
    assert.equal(snapshot.compositeTalentPoolSize, 0);
    assert.equal(snapshot.compositeTalentPoolSeeded, false);
    assert.equal(snapshot.projectJourneyCount, 0);
    // Every step starts at 0 — no projects in the DB yet.
    for (const value of Object.values(snapshot.projectJourneyCountByStep)) {
      assert.equal(value, 0);
    }
    // Pure probe — always healthy on a fresh checkout.
    assert.equal(snapshot.producerDeterministicHealthy, true);
  });
});

test("getTracerHealthSnapshot surfaces composite pool count and seeded flag once composites land", async () => {
  await withFreshDb(async (db) => {
    // Seed a small composite set manually — the seed script's
    // threshold (≥8) drives compositeTalentPoolSeeded.
    for (let i = 0; i < 9; i++) {
      const person = await db.person.create({
        data: { name: `Composite ${i}`, source: "DEMO_COMPOSITE" },
      });
      await db.creatorProfile.create({
        data: {
          personId: person.id,
          displayName: `Composite ${i}`,
          roles: ["host"],
          reviewStatus: "APPROVED",
        },
      });
    }
    const snapshot = await getTracerHealthSnapshot();
    assert.equal(snapshot.compositeTalentPoolSize, 9);
    assert.equal(snapshot.compositeTalentPoolSeeded, true);
  });
});

test("getTracerHealthSnapshot counts journey rows by step", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);
    // completeBrief crosses readiness so the journey is at brief_ready.
    let snapshot = await getTracerHealthSnapshot();
    assert.equal(snapshot.projectJourneyCount, 1);
    assert.equal(snapshot.projectJourneyCountByStep.brief_ready, 1);
    assert.equal(snapshot.projectJourneyCountByStep.intake, 0);
    assert.equal(snapshot.projectJourneyCountByStep.archived, 0);

    // Archive flips it to archived.
    await archiveProject(upsert.projectId!);
    snapshot = await getTracerHealthSnapshot();
    assert.equal(snapshot.projectJourneyCount, 1);
    assert.equal(snapshot.projectJourneyCountByStep.archived, 1);
    assert.equal(snapshot.projectJourneyCountByStep.brief_ready, 0);
  });
});

test("getTracerHealthSnapshot surfaces the latest applied migration", async () => {
  await withFreshDb(async () => {
    const snapshot = await getTracerHealthSnapshot();
    // The test DB has migrations applied; the helper should find them.
    assert.ok(
      snapshot.latestMigration,
      "test environment has migrations applied, so the helper should return one",
    );
    assert.ok(snapshot.latestMigration.name.length > 0);
    // ISO 8601 timestamp.
    assert.match(
      snapshot.latestMigration.appliedAt,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });
});

test("getTracerHealthSnapshot degrades gracefully when DATABASE_URL is not set", async () => {
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const snapshot = await getTracerHealthSnapshot();
    assert.equal(snapshot.tracerHealthAvailable, false);
    assert.equal(snapshot.compositeTalentPoolSize, 0);
    assert.equal(snapshot.projectJourneyCount, 0);
    assert.equal(snapshot.latestMigration, null);
    // Producer probe is DB-free — still healthy.
    assert.equal(snapshot.producerDeterministicHealthy, true);
  } finally {
    if (originalUrl) process.env.DATABASE_URL = originalUrl;
  }
});
