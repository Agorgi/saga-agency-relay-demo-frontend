import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await db.webSession.deleteMany();
    await db.projectJourney.deleteMany();
    await db.project.deleteMany();
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}

const completeOrganizerFields = {
  projectIdea: "Formal ball inspired by Love and Deepspace",
  locationMarket: "Los Angeles",
  timing: "July",
  scopeFormat: "ball",
  themeVibe: "romantic, elegant, space-inspired",
  expectedAttendance: "150 people",
  lineupStatus: "one photographer friend",
  helpNeeded: "find a producer, stylist, venue lead, and performers",
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
  desiredTalentRoles: ["Producer", "Stylist", "Venue Lead", "Performer"],
};

const minimalOrganizerFields = {
  ...completeOrganizerFields,
  locationMarket: null,
  timing: null,
  expectedAttendance: null,
  scopeFormat: null,
  themeVibe: null,
  budget: null,
  helpNeeded: null,
  desiredTalentRoles: [],
};

test("upsertProjectFromBrief no-ops for non-host personas", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    for (const persona of ["creative", "venue", "fan"] as const) {
      const result = await upsertProjectFromBrief({
        sessionId: session.id,
        persona,
        organizerFields: completeOrganizerFields,
      });
      assert.equal(result.projectId, null, `persona=${persona} should not persist a Project`);
      assert.equal(result.journey, null);
    }

    const sessionAfter = await db.webSession.findUnique({ where: { id: session.id } });
    assert.equal(sessionAfter?.projectId, null);
  });
});

test("upsertProjectFromBrief no-ops when projectIdea is missing", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    const result = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: { ...completeOrganizerFields, projectIdea: null },
    });
    assert.equal(result.projectId, null);
    assert.equal(result.journey, null);
  });
});

test("upsertProjectFromBrief creates Project + intake Journey on first host call", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    // Start with a seed brief that doesn't yet meet brief_ready threshold.
    const result = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: minimalOrganizerFields,
    });

    assert.ok(result.projectId, "projectId should be set");
    assert.ok(result.journey, "journey should be set");
    assert.equal(result.journey?.step, "intake");

    // WebSession is linked.
    const sessionAfter = await db.webSession.findUnique({
      where: { id: session.id },
    });
    assert.equal(sessionAfter?.projectId, result.projectId);

    // Project carries the brief fields we sent in.
    const project = await db.project.findUnique({
      where: { id: result.projectId! },
    });
    assert.ok(project);
    assert.match(project?.title || "", /Formal ball/);
    assert.equal(project?.source, "WEB_APP");
  });
});

test("upsertProjectFromBrief is idempotent: updates the same Project on subsequent calls", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    const first = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: minimalOrganizerFields,
    });
    assert.ok(first.projectId);

    // Second call with richer brief: same project, updated fields.
    const second = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeOrganizerFields,
    });
    assert.equal(second.projectId, first.projectId);

    const project = await db.project.findUnique({
      where: { id: second.projectId! },
    });
    assert.equal(project?.city, "Los Angeles");
    assert.equal(project?.targetDate, "July");
    assert.equal(project?.budgetRange, "$15k");
  });
});

test("upsertProjectFromBrief advances intake → brief_ready once readiness crosses threshold", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    // Minimal brief: stays at intake.
    const first = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: minimalOrganizerFields,
    });
    assert.equal(first.journey?.step, "intake");

    // Complete brief: advances to brief_ready.
    const second = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeOrganizerFields,
    });
    assert.equal(second.journey?.step, "brief_ready");
    assert.equal(second.journey?.primaryAction.enabled, true);
    assert.match(second.journey?.primaryAction.label || "", /Build my crew/);
    assert.equal(
      second.journey?.primaryAction.href,
      `/projects/${second.projectId}/crew`,
    );
  });
});

test("upsertProjectFromBrief is safe to call repeatedly after brief_ready (no regression)", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeOrganizerFields,
    });
    const again = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeOrganizerFields,
    });

    // The journey stays at brief_ready — once you cross the threshold, further
    // calls don't re-advance or revert. (Soft revert is an explicit user
    // action, not a side effect of re-running the upsert.)
    assert.equal(again.journey?.step, "brief_ready");
  });
});
