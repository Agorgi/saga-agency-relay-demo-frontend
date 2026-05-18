import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import {
  jsonForAuthFailure,
  requireCandidateOwnership,
  requireProjectOwnership,
  sessionOwnsProject,
} from "@/lib/projectAuth";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import { WEB_SESSION_COOKIE_NAME } from "@/lib/webChatSessionStore";

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

function buildRequest(opts?: { sessionId?: string }): NextRequest {
  const headers = new Headers();
  if (opts?.sessionId) {
    headers.set("cookie", `${WEB_SESSION_COOKIE_NAME}=${opts.sessionId}`);
  }
  return new NextRequest("http://localhost:3000/api/projects/x", { headers });
}

async function setupProjectWithOwner(db: PrismaClient) {
  const session = await db.webSession.create({ data: {} });
  const upsert = await upsertProjectFromBrief({
    sessionId: session.id,
    persona: "host",
    organizerFields: {
      projectIdea: "Formal ball",
      locationMarket: "LA",
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
    },
  });
  const projectId = upsert.projectId;
  assert.ok(projectId);
  return { sessionId: session.id, projectId: projectId as string };
}

test("requireProjectOwnership returns 401 when no session cookie is present", async () => {
  await withFreshDb(async () => {
    const result = await requireProjectOwnership(
      buildRequest(),
      "cm0abc123def456ghi789jkl",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.error, "no_session");
    }
  });
});

test("requireProjectOwnership returns 401 when the session cookie doesn't match any DB session", async () => {
  await withFreshDb(async () => {
    const result = await requireProjectOwnership(
      buildRequest({ sessionId: "nonexistent-session-id" }),
      "cm0abc123def456ghi789jkl",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.error, "no_session");
    }
  });
});

test("requireProjectOwnership returns 403 when the session doesn't own the requested project", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithOwner(db);
    // A different session that has no project.
    const otherSession = await db.webSession.create({ data: {} });

    const result = await requireProjectOwnership(
      buildRequest({ sessionId: otherSession.id }),
      ctx.projectId,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
      assert.equal(result.error, "not_project_owner");
    }
  });
});

test("requireProjectOwnership returns 403 when a session owns a DIFFERENT project than the URL requests", async () => {
  await withFreshDb(async (db) => {
    const ctxA = await setupProjectWithOwner(db);
    const ctxB = await setupProjectWithOwner(db);
    // Session A owns project A; asking for project B → 403.
    const result = await requireProjectOwnership(
      buildRequest({ sessionId: ctxA.sessionId }),
      ctxB.projectId,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
      assert.equal(result.error, "not_project_owner");
    }
  });
});

test("requireProjectOwnership returns ok when the session owns the project", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithOwner(db);
    const result = await requireProjectOwnership(
      buildRequest({ sessionId: ctx.sessionId }),
      ctx.projectId,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sessionId, ctx.sessionId);
    }
  });
});

test("requireCandidateOwnership returns 404 when the candidate doesn't exist", async () => {
  await withFreshDb(async () => {
    const session = await new PrismaClient({
      datasourceUrl: TEST_DATABASE_URL,
    }).webSession.create({ data: {} });
    const result = await requireCandidateOwnership(
      buildRequest({ sessionId: session.id }),
      "cm0nonexistentcandidate0",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 404);
      assert.equal(result.error, "candidate_not_found");
    }
  });
});

test("requireCandidateOwnership returns 401 when there's no session", async () => {
  await withFreshDb(async () => {
    const result = await requireCandidateOwnership(
      buildRequest(),
      "cm0somecandidateid000000",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
      assert.equal(result.error, "no_session");
    }
  });
});

test("requireCandidateOwnership returns ok when the session owns the candidate's project", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithOwner(db);
    const role = await db.roleOpening.create({
      data: {
        projectId: ctx.projectId,
        roleType: "producer",
        title: "Producer",
        status: "OPEN",
      },
    });
    const opp = await db.opportunity.create({
      data: {
        roleOpeningId: role.id,
        visibility: "PRIVATE",
        applicationMode: "INVITE_ONLY",
        status: "ACTIVE",
      },
    });
    const person = await db.person.create({
      data: { name: "Maya", source: "ADMIN" },
    });
    const rec = await db.candidateRecommendation.create({
      data: {
        opportunityId: opp.id,
        personId: person.id,
        score: 0.9,
        status: "SUGGESTED",
      },
    });

    const result = await requireCandidateOwnership(
      buildRequest({ sessionId: ctx.sessionId }),
      rec.id,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.sessionId, ctx.sessionId);
      assert.equal(result.projectId, ctx.projectId);
    }
  });
});

test("requireCandidateOwnership returns 403 when the session owns a different project than the candidate's", async () => {
  await withFreshDb(async (db) => {
    const ctxA = await setupProjectWithOwner(db);
    const ctxB = await setupProjectWithOwner(db);
    // Candidate belongs to project B.
    const role = await db.roleOpening.create({
      data: {
        projectId: ctxB.projectId,
        roleType: "producer",
        title: "Producer",
        status: "OPEN",
      },
    });
    const opp = await db.opportunity.create({
      data: {
        roleOpeningId: role.id,
        visibility: "PRIVATE",
        applicationMode: "INVITE_ONLY",
        status: "ACTIVE",
      },
    });
    const person = await db.person.create({
      data: { name: "Maya", source: "ADMIN" },
    });
    const rec = await db.candidateRecommendation.create({
      data: {
        opportunityId: opp.id,
        personId: person.id,
        score: 0.9,
        status: "SUGGESTED",
      },
    });

    // Session A asks to review candidate that belongs to project B → 403.
    const result = await requireCandidateOwnership(
      buildRequest({ sessionId: ctxA.sessionId }),
      rec.id,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 403);
      assert.equal(result.error, "not_project_owner");
    }
  });
});

test("jsonForAuthFailure returns a Response with the right status and error body", async () => {
  const response401 = jsonForAuthFailure({
    ok: false,
    status: 401,
    error: "no_session",
  });
  assert.equal(response401.status, 401);
  const body401 = (await response401.json()) as { error: string };
  assert.equal(body401.error, "no_session");

  const response403 = jsonForAuthFailure({
    ok: false,
    status: 403,
    error: "not_project_owner",
  });
  assert.equal(response403.status, 403);
  const body403 = (await response403.json()) as { error: string };
  assert.equal(body403.error, "not_project_owner");
});

test("sessionOwnsProject returns false when sessionId is null or undefined", async () => {
  await withFreshDb(async () => {
    assert.equal(await sessionOwnsProject(null, "cm0abc123def456ghi789jkl"), false);
    assert.equal(
      await sessionOwnsProject(undefined, "cm0abc123def456ghi789jkl"),
      false,
    );
    assert.equal(await sessionOwnsProject("", "cm0abc123def456ghi789jkl"), false);
  });
});

test("sessionOwnsProject returns false when session doesn't exist in DB", async () => {
  await withFreshDb(async () => {
    assert.equal(
      await sessionOwnsProject(
        "nonexistent-session-id",
        "cm0abc123def456ghi789jkl",
      ),
      false,
    );
  });
});

test("sessionOwnsProject returns false when session exists but owns a different project", async () => {
  await withFreshDb(async (db) => {
    const ctxA = await setupProjectWithOwner(db);
    const ctxB = await setupProjectWithOwner(db);
    // Session A owns project A; checking ownership of project B → false.
    assert.equal(await sessionOwnsProject(ctxA.sessionId, ctxB.projectId), false);
  });
});

test("sessionOwnsProject returns true when the session owns the requested project", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithOwner(db);
    assert.equal(await sessionOwnsProject(ctx.sessionId, ctx.projectId), true);
  });
});

test("sessionOwnsProject returns false when session has no project assigned", async () => {
  await withFreshDb(async (db) => {
    // A session that was created but never persisted a brief — its
    // projectId is null. Any project-ownership check must return
    // false for this session.
    const orphanSession = await db.webSession.create({ data: {} });
    assert.equal(
      await sessionOwnsProject(orphanSession.id, "cm0abc123def456ghi789jkl"),
      false,
    );
  });
});
