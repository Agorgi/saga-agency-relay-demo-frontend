import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { loadProjectsListView } from "@/lib/projectsListView";
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

const minimalBrief = {
  projectIdea: "Formal ball inspired by Love and Deepspace",
  locationMarket: "Los Angeles",
  timing: "July",
  scopeFormat: null,
  themeVibe: null,
  expectedAttendance: null,
  lineupStatus: null,
  helpNeeded: null,
  budget: null,
  budgetStatus: null,
  inspirationStatus: null,
  inspirationReferences: [] as string[],
  userRole: null,
  userIdentity: null,
  organization: null,
  socials: [],
  audience: null,
  ticketingModel: null,
  safetyFlags: [],
  urgency: null,
  desiredTalentRoles: [],
};

test("loadProjectsListView returns empty when sessionId is null", async () => {
  const data = await loadProjectsListView(null);
  assert.deepEqual(data, { projects: [] });
});

test("loadProjectsListView returns empty when sessionId is undefined", async () => {
  const data = await loadProjectsListView(undefined);
  assert.deepEqual(data, { projects: [] });
});

test("loadProjectsListView returns empty when sessionId is empty string", async () => {
  const data = await loadProjectsListView("");
  assert.deepEqual(data, { projects: [] });
});

test("loadProjectsListView returns empty when the session id doesn't match a DB session", async () => {
  await withFreshDb(async () => {
    const data = await loadProjectsListView("nonexistent-session");
    assert.deepEqual(data, { projects: [] });
  });
});

test("loadProjectsListView returns empty when the session has no projectId yet", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const data = await loadProjectsListView(session.id);
    assert.deepEqual(data, { projects: [] });
  });
});

test("loadProjectsListView returns empty when session.projectId references a deleted project", async () => {
  await withFreshDb(async (db) => {
    // Set up a session pointing at a project, then delete the project.
    const project = await db.project.create({ data: { source: "WEB_APP" } });
    const session = await db.webSession.create({
      data: { projectId: project.id },
    });
    await db.project.delete({ where: { id: project.id } });

    const data = await loadProjectsListView(session.id);
    // Project is gone; the loader must not throw and must return an empty list.
    assert.deepEqual(data, { projects: [] });
  });
});

test("loadProjectsListView returns the session's project at intake with the brief title", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: minimalBrief,
    });
    assert.ok(upsert.projectId);

    const data = await loadProjectsListView(session.id);
    assert.equal(data.projects.length, 1);
    const [project] = data.projects;
    assert.equal(project.projectId, upsert.projectId);
    assert.match(project.title, /Formal ball/);
    assert.equal(project.city, "Los Angeles");
    assert.equal(project.targetDate, "July");
    assert.equal(project.journey.step, "intake");
    assert.equal(project.journey.primaryAction.enabled, true);
    assert.ok(project.updatedAt instanceof Date);
  });
});

test("loadProjectsListView title falls back to 'Your project' when no title is set", async () => {
  await withFreshDb(async (db) => {
    const project = await db.project.create({ data: { source: "WEB_APP" } });
    const session = await db.webSession.create({
      data: { projectId: project.id },
    });

    const data = await loadProjectsListView(session.id);
    assert.equal(data.projects.length, 1);
    assert.equal(data.projects[0].title, "Your project");
  });
});

test("loadProjectsListView includes the journey row even when one didn't exist before", async () => {
  // The journey state machine landed after Project. A legacy Project without a
  // ProjectJourney row must still surface in the list — getOrCreateJourney
  // creates a default 'intake' row on first read.
  await withFreshDb(async (db) => {
    const project = await db.project.create({ data: { source: "WEB_APP" } });
    const session = await db.webSession.create({
      data: { projectId: project.id },
    });

    const data = await loadProjectsListView(session.id);
    assert.equal(data.projects.length, 1);
    assert.equal(data.projects[0].journey.step, "intake");
  });
});

test("loadProjectsListView surfaces the brief_ready journey when readiness has crossed", async () => {
  const completeBrief = {
    ...minimalBrief,
    scopeFormat: "ball",
    themeVibe: "romantic, elegant, space-inspired",
    expectedAttendance: "150 people",
    lineupStatus: "one photographer friend",
    helpNeeded: "find a producer, stylist, venue lead, and performers",
    budget: "$15k",
    inspirationStatus: "provided" as const,
    inspirationReferences: ["Love and Deepspace"],
    desiredTalentRoles: ["Producer", "Stylist", "Venue Lead", "Performer"],
  };

  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.equal(upsert.journey?.step, "brief_ready");

    const data = await loadProjectsListView(session.id);
    assert.equal(data.projects.length, 1);
    assert.equal(data.projects[0].journey.step, "brief_ready");
    assert.match(
      data.projects[0].journey.primaryAction.label,
      /Build my crew/,
    );
  });
});

test("loadProjectsListView hides projects whose journey is at archived", async () => {
  // PR #54: a user who archives a brief should see a clean empty
  // state on /projects (then start fresh in /chat). The project row
  // and the journey row both still exist; the loader filters on
  // journey.step.
  const { archiveProject } = await import("@/lib/projectArchive");
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: minimalBrief,
    });
    assert.ok(upsert.projectId);

    // Before archive: project surfaces.
    const before = await loadProjectsListView(session.id);
    assert.equal(before.projects.length, 1);

    // archiveProject also unbinds the session, so we capture the
    // session id ahead of time and re-load via the same id.
    const sessionId = session.id;
    await archiveProject(upsert.projectId!);

    // After archive: session was unbound, so the loader returns empty
    // for the most direct reason (session.projectId is null). Verify
    // that AND simulate the "session still has projectId" path by
    // re-binding manually to isolate the journey-step filter.
    const afterUnbind = await loadProjectsListView(sessionId);
    assert.deepEqual(afterUnbind, { projects: [] });

    await db.webSession.update({
      where: { id: sessionId },
      data: { projectId: upsert.projectId },
    });
    const afterRebind = await loadProjectsListView(sessionId);
    assert.deepEqual(
      afterRebind,
      { projects: [] },
      "even with the session re-bound, archived projects must not appear",
    );
  });
});
