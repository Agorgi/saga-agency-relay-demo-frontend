import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { archiveProject } from "@/lib/projectArchive";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import { getOrCreateJourney } from "@/lib/journey/service";

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

test("archiveProject returns project_not_found when the id doesn't resolve", async () => {
  await withFreshDb(async () => {
    const result = await archiveProject("cm0nonexistentproject0");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "project_not_found");
  });
});

test("archiveProject advances journey to archived and unbinds the owning session", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const result = await archiveProject(upsert.projectId!);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.journey.step, "archived");
      assert.equal(
        result.sessionsUnbound,
        1,
        "the single session that owned the project should be unbound",
      );
    }

    // Session.projectId should be null after archive — the next chat
    // turn would create a fresh Project rather than mutating this one.
    const refreshedSession = await db.webSession.findUnique({
      where: { id: session.id },
      select: { projectId: true },
    });
    assert.equal(refreshedSession?.projectId, null);

    // Project row still exists — archive is not deletion.
    const projectExists = await db.project.findUnique({
      where: { id: upsert.projectId! },
      select: { id: true },
    });
    assert.ok(projectExists, "Project row should still exist after archive");
  });
});

test("archiveProject is idempotent — second call returns already_archived without re-mutating", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const first = await archiveProject(upsert.projectId!);
    assert.equal(first.ok, true);

    // A second call should hit the "already archived" branch instead
    // of throwing a journey transition error.
    const second = await archiveProject(upsert.projectId!);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.reason, "already_archived");

    // Confirm the journey is still at archived (didn't get bumped).
    const journey = await getOrCreateJourney(upsert.projectId!);
    assert.equal(journey.step, "archived");
  });
});

test("archiveProject unbinds every session pointing at the project, not just one", async () => {
  // Today the schema supports multiple WebSessions per project (1:N
  // from the Project side via WebSession.projectId). When archive
  // fires, all of them must be unbound — otherwise a stale session
  // could still mutate the archived row on its next chat turn.
  await withFreshDb(async (db) => {
    const sessionA = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: sessionA.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);
    // Manually create a second session pointing at the same project.
    const sessionB = await db.webSession.create({
      data: { projectId: upsert.projectId! },
    });

    const result = await archiveProject(upsert.projectId!);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.sessionsUnbound, 2);

    for (const id of [sessionA.id, sessionB.id]) {
      const refreshed = await db.webSession.findUnique({
        where: { id },
        select: { projectId: true },
      });
      assert.equal(refreshed?.projectId, null);
    }
  });
});
