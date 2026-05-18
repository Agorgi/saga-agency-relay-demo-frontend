import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { approveProjectOutreach } from "@/lib/outreachApproval";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import {
  advanceJourney,
  getOrCreateJourney,
} from "@/lib/journey/service";

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

async function setupProjectAtOutreachPrep(db: PrismaClient) {
  const session = await db.webSession.create({ data: {} });
  const upsert = await upsertProjectFromBrief({
    sessionId: session.id,
    persona: "host",
    organizerFields: {
      projectIdea: "Cosmic-romantic ball",
      locationMarket: "LA",
      timing: "July",
      scopeFormat: "ball",
      themeVibe: "romantic",
      expectedAttendance: "150",
      lineupStatus: "one friend",
      helpNeeded: "producer, stylist",
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

  const projectId = upsert.projectId!;
  await advanceJourney(projectId, "build_crew");
  await advanceJourney(projectId, "approve_candidates");

  const role = await db.roleOpening.create({
    data: {
      projectId,
      roleType: "producer",
      title: "Producer",
      status: "OUTREACHING",
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
      status: "APPROVED_FOR_SHORTLIST",
    },
  });

  return { projectId, role, rec, person };
}

test("approveProjectOutreach returns null for unknown project", async () => {
  await withFreshDb(async () => {
    const result = await approveProjectOutreach({
      projectId: "cm0000000000000000000000",
      action: "approve_all",
    });
    assert.equal(result, null);
  });
});

test("approveProjectOutreach approves NEEDS_REVIEW drafts and advances journey", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "NEEDS_REVIEW",
        body: "Hi Maya.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
      },
    });

    const result = await approveProjectOutreach({
      projectId: ctx.projectId,
      action: "approve_all",
    });
    assert.ok(result);
    assert.equal(result?.approvedCount, 1);
    assert.equal(result?.journeyAdvanced, true);

    const journey = await getOrCreateJourney(ctx.projectId);
    assert.equal(journey.step, "outreach_awaiting_send");

    const draft = await db.outboundDraft.findFirst({
      where: { projectId: ctx.projectId },
    });
    assert.equal(draft?.status, "APPROVED");
    assert.ok(draft?.approvedAt);
    assert.equal(draft?.approvedBy, "user");
  });
});

test("approveProjectOutreach is idempotent — re-approving at outreach_awaiting_send is a no-op", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "NEEDS_REVIEW",
        body: "Hi Maya.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
      },
    });

    await approveProjectOutreach({
      projectId: ctx.projectId,
      action: "approve_all",
    });
    // Second call: journey is already at outreach_awaiting_send.
    const second = await approveProjectOutreach({
      projectId: ctx.projectId,
      action: "approve_all",
    });
    assert.equal(second?.approvedCount, 0);
    assert.equal(second?.journeyAdvanced, false);
  });
});

test("approveProjectOutreach refuses to act when journey is before outreach_prep", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: {
        projectIdea: "Cosmic-romantic ball",
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

    const projectId = upsert.projectId!;
    // Stop at brief_ready — never advanced past it. approveProjectOutreach
    // must refuse to mutate drafts or advance the journey.
    const result = await approveProjectOutreach({
      projectId,
      action: "approve_all",
    });
    assert.ok(result);
    assert.equal(result?.approvedCount, 0);
    assert.equal(result?.journeyAdvanced, false);

    const journey = await getOrCreateJourney(projectId);
    assert.equal(journey.step, "brief_ready");
  });
});

test("approveProjectOutreach doesn't touch already-APPROVED drafts", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    const alreadyApprovedAt = new Date("2026-01-01T00:00:00.000Z");
    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "APPROVED",
        body: "Pre-approved draft.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
        approvedAt: alreadyApprovedAt,
        approvedBy: "earlier-actor",
      },
    });

    const result = await approveProjectOutreach({
      projectId: ctx.projectId,
      action: "approve_all",
    });
    // Zero new approvals — the existing APPROVED row is untouched.
    assert.equal(result?.approvedCount, 0);
    assert.equal(result?.journeyAdvanced, true);

    const draft = await db.outboundDraft.findFirst({
      where: { projectId: ctx.projectId },
    });
    assert.equal(draft?.status, "APPROVED");
    assert.equal(draft?.approvedAt?.toISOString(), alreadyApprovedAt.toISOString());
    assert.equal(draft?.approvedBy, "earlier-actor");
  });
});
