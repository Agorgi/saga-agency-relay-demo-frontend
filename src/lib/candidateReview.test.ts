import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { reviewCandidate } from "@/lib/candidateReview";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";
import { getOrCreateJourney, advanceJourney } from "@/lib/journey/service";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
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

async function setupProjectWithRolesAndCandidates(db: PrismaClient) {
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
      desiredTalentRoles: ["Producer", "Stylist"],
    },
  });

  // Need to be in crew_reviewing for the approve flow to trigger
  // outreach_prep transition.
  await advanceJourney(upsert.projectId!, "build_crew");

  const producerRole = await db.roleOpening.create({
    data: {
      projectId: upsert.projectId!,
      roleType: "producer",
      title: "Producer",
      status: "OPEN",
    },
  });
  const stylistRole = await db.roleOpening.create({
    data: {
      projectId: upsert.projectId!,
      roleType: "stylist",
      title: "Stylist",
      status: "OPEN",
    },
  });
  const producerOpp = await db.opportunity.create({
    data: {
      roleOpeningId: producerRole.id,
      visibility: "PRIVATE",
      applicationMode: "INVITE_ONLY",
      status: "ACTIVE",
    },
  });
  const stylistOpp = await db.opportunity.create({
    data: {
      roleOpeningId: stylistRole.id,
      visibility: "PRIVATE",
      applicationMode: "INVITE_ONLY",
      status: "ACTIVE",
    },
  });
  const maya = await db.person.create({
    data: { name: "Maya", source: "ADMIN" },
  });
  const jordan = await db.person.create({
    data: { name: "Jordan", source: "ADMIN" },
  });
  const producerRec = await db.candidateRecommendation.create({
    data: {
      opportunityId: producerOpp.id,
      personId: maya.id,
      score: 0.9,
      status: "SUGGESTED",
    },
  });
  const stylistRec = await db.candidateRecommendation.create({
    data: {
      opportunityId: stylistOpp.id,
      personId: jordan.id,
      score: 0.8,
      status: "SUGGESTED",
    },
  });

  return {
    projectId: upsert.projectId!,
    producerRec,
    stylistRec,
  };
}

test("reviewCandidate returns null for an unknown candidate", async () => {
  await withFreshDb(async () => {
    const result = await reviewCandidate({
      candidateId: "cm0000000000000000000000",
      action: "approve",
    });
    assert.equal(result, null);
  });
});

test("reviewCandidate('pass') sets REJECTED, no journey advance", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithRolesAndCandidates(db);
    const result = await reviewCandidate({
      candidateId: ctx.producerRec.id,
      action: "pass",
    });
    assert.equal(result?.newStatus, "REJECTED");
    assert.equal(result?.journeyAdvanced, false);

    const journey = await getOrCreateJourney(ctx.projectId);
    assert.equal(journey.step, "crew_reviewing");
  });
});

test("reviewCandidate('request_info') sets NEEDS_MORE_INFO, no journey advance", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithRolesAndCandidates(db);
    const result = await reviewCandidate({
      candidateId: ctx.producerRec.id,
      action: "request_info",
    });
    assert.equal(result?.newStatus, "NEEDS_MORE_INFO");
    assert.equal(result?.journeyAdvanced, false);
  });
});

test("reviewCandidate('approve') sets APPROVED_FOR_SHORTLIST and does NOT advance journey until every core role has an approval", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithRolesAndCandidates(db);

    // Approve producer only → stylist is still unapproved → no advance.
    const first = await reviewCandidate({
      candidateId: ctx.producerRec.id,
      action: "approve",
    });
    assert.equal(first?.newStatus, "APPROVED_FOR_SHORTLIST");
    assert.equal(first?.journeyAdvanced, false);
    let journey = await getOrCreateJourney(ctx.projectId);
    assert.equal(journey.step, "crew_reviewing");

    // Approve stylist → all core roles covered → advance to outreach_prep.
    const second = await reviewCandidate({
      candidateId: ctx.stylistRec.id,
      action: "approve",
    });
    assert.equal(second?.newStatus, "APPROVED_FOR_SHORTLIST");
    assert.equal(second?.journeyAdvanced, true);
    journey = await getOrCreateJourney(ctx.projectId);
    assert.equal(journey.step, "outreach_prep");
  });
});

test("once journey is past crew_reviewing, further approves don't try to advance again", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectWithRolesAndCandidates(db);
    await reviewCandidate({ candidateId: ctx.producerRec.id, action: "approve" });
    await reviewCandidate({ candidateId: ctx.stylistRec.id, action: "approve" });

    // Re-approve producer (still APPROVED_FOR_SHORTLIST). Journey is at
    // outreach_prep — no further advance should happen.
    const result = await reviewCandidate({
      candidateId: ctx.producerRec.id,
      action: "approve",
    });
    assert.equal(result?.journeyAdvanced, false);
    const journey = await getOrCreateJourney(ctx.projectId);
    assert.equal(journey.step, "outreach_prep");
  });
});
