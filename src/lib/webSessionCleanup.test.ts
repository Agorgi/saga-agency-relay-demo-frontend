import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  cleanupStaleSessions,
  findStaleSessions,
  getConfiguredTtlDays,
} from "@/lib/webSessionCleanup";
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
    await db.webChatMessage.deleteMany();
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

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);

test("getConfiguredTtlDays defaults to 90 and reads WEB_SESSION_TTL_DAYS when set", () => {
  const original = process.env.WEB_SESSION_TTL_DAYS;
  try {
    delete process.env.WEB_SESSION_TTL_DAYS;
    assert.equal(getConfiguredTtlDays(), 90);
    process.env.WEB_SESSION_TTL_DAYS = "30";
    assert.equal(getConfiguredTtlDays(), 30);
    process.env.WEB_SESSION_TTL_DAYS = "not-a-number";
    assert.equal(getConfiguredTtlDays(), 90, "falls back on parse failure");
    process.env.WEB_SESSION_TTL_DAYS = "0";
    assert.equal(getConfiguredTtlDays(), 90, "falls back on non-positive value");
  } finally {
    if (original) {
      process.env.WEB_SESSION_TTL_DAYS = original;
    } else {
      delete process.env.WEB_SESSION_TTL_DAYS;
    }
  }
});

test("findStaleSessions skips sessions whose lastSeenAt is within the TTL", async () => {
  await withFreshDb(async (db) => {
    // Recent session — should NOT show up.
    await db.webSession.create({
      data: {
        // lastSeenAt is @updatedAt so it defaults to now; force via update
      },
    });
    const stale = await findStaleSessions({ ttlDays: 90 });
    assert.equal(stale.length, 0);
  });
});

test("findStaleSessions picks up no-project sessions older than the TTL", async () => {
  await withFreshDb(async (db) => {
    // Force lastSeenAt back by editing via raw SQL (Prisma's
    // @updatedAt fights us otherwise).
    const created = await db.webSession.create({ data: {} });
    await db.$executeRaw`
      UPDATE "WebSession"
      SET "lastSeenAt" = ${daysAgo(120)}
      WHERE id = ${created.id}
    `;

    const stale = await findStaleSessions({ ttlDays: 90 });
    assert.equal(stale.length, 1);
    assert.equal(stale[0].id, created.id);
    assert.equal(stale[0].projectId, null);
    assert.equal(stale[0].projectJourneyStep, null);
  });
});

test("findStaleSessions keeps sessions with active projects even when lastSeenAt is old", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);
    // Brief crosses readiness so journey is brief_ready, NOT archived.
    await db.$executeRaw`
      UPDATE "WebSession"
      SET "lastSeenAt" = ${daysAgo(180)}
      WHERE id = ${session.id}
    `;

    const stale = await findStaleSessions({ ttlDays: 90 });
    assert.equal(
      stale.length,
      0,
      "active-project sessions must NOT be eligible for cleanup",
    );
  });
});

test("findStaleSessions picks up sessions whose project is archived", async () => {
  // Edge case: PR #54's archive helper clears `WebSession.projectId`,
  // so the common archived-session path is "projectId is null" (covered
  // by the no-project test above). This case covers the defensive
  // fallback — a session whose projectId was NOT unbound but the
  // project is at journey.step = "archived". Could happen if a future
  // admin path archives via journey state machine without unbinding.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    await archiveProject(upsert.projectId!);

    // Re-bind the session to the now-archived project (simulating
    // the defensive case where archive didn't unbind).
    await db.webSession.update({
      where: { id: session.id },
      data: { projectId: upsert.projectId },
    });
    await db.$executeRaw`
      UPDATE "WebSession"
      SET "lastSeenAt" = ${daysAgo(120)}
      WHERE id = ${session.id}
    `;

    const stale = await findStaleSessions({ ttlDays: 90 });
    assert.equal(stale.length, 1);
    assert.equal(stale[0].id, session.id);
    assert.equal(stale[0].projectJourneyStep, "archived");
  });
});

test("cleanupStaleSessions in dry-run mode reports candidates but does NOT delete", async () => {
  await withFreshDb(async (db) => {
    const created = await db.webSession.create({ data: {} });
    await db.$executeRaw`
      UPDATE "WebSession"
      SET "lastSeenAt" = ${daysAgo(120)}
      WHERE id = ${created.id}
    `;

    const result = await cleanupStaleSessions({ ttlDays: 90, dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.deleted, 0);

    // Session row still exists.
    const stillThere = await db.webSession.findUnique({
      where: { id: created.id },
    });
    assert.ok(stillThere, "dry-run must not delete");
  });
});

test("cleanupStaleSessions with dryRun=false deletes stale sessions and cascades to WebChatMessage", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    // Add some chat history that should cascade away with the session.
    await db.webChatMessage.create({
      data: {
        sessionId: session.id,
        conversationId: "conv-old",
        role: "user",
        content: "stale message",
        turn: 0,
      },
    });
    await db.$executeRaw`
      UPDATE "WebSession"
      SET "lastSeenAt" = ${daysAgo(120)}
      WHERE id = ${session.id}
    `;

    const result = await cleanupStaleSessions({ ttlDays: 90, dryRun: false });
    assert.equal(result.dryRun, false);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.deleted, 1);

    const stillThere = await db.webSession.findUnique({
      where: { id: session.id },
    });
    assert.equal(stillThere, null, "session row should be gone");

    // WebChatMessage cascades on session delete.
    const messageStillThere = await db.webChatMessage.findFirst({
      where: { sessionId: session.id },
    });
    assert.equal(
      messageStillThere,
      null,
      "WebChatMessage should cascade away with the session",
    );
  });
});

test("cleanupStaleSessions records an audit log entry on every run", async () => {
  await withFreshDb(async (db) => {
    const result = await cleanupStaleSessions({ ttlDays: 90, dryRun: true });

    const auditEntries = await db.auditLog.findMany({
      where: { action: "web_session.cleanup" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(
      auditEntries.length >= 1,
      "audit log entry should be recorded for every cleanup run",
    );
    const latest = auditEntries[0];
    const meta = (latest.metadata ?? {}) as Record<string, unknown>;
    assert.equal(meta.dryRun, true);
    assert.equal(meta.ttlDays, 90);
    assert.equal(meta.candidateCount, result.candidates.length);
    assert.equal(meta.deletedCount, 0);
  });
});

test("cleanupStaleSessions degrades safely with no DATABASE_URL set", async () => {
  const originalUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const result = await cleanupStaleSessions({ ttlDays: 90, dryRun: true });
    assert.equal(result.candidates.length, 0);
    assert.equal(result.deleted, 0);
  } finally {
    if (originalUrl) process.env.DATABASE_URL = originalUrl;
  }
});
