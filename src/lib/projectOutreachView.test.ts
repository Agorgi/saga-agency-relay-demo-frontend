import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { loadOutreachView } from "@/lib/projectOutreachView";
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
      desiredTalentRoles: ["Producer", "Stylist"],
    },
  });

  const projectId = upsert.projectId!;

  // Drive the journey to outreach_prep via the canonical edges.
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
      matchingReasons: ["Has produced two LA anime ball events"],
    },
  });

  return { projectId, role, rec, person };
}

test("loadOutreachView returns null when slug is not a project id", async () => {
  await withFreshDb(async () => {
    const result = await loadOutreachView("legacy-fixture-slug");
    assert.equal(result, null);
  });
});

test("loadOutreachView returns null when project doesn't exist", async () => {
  await withFreshDb(async () => {
    // Looks like a project id (cuid-ish) but doesn't exist.
    const result = await loadOutreachView("cm0000000000000000000000");
    assert.equal(result, null);
  });
});

test("loadOutreachView reports 'before_outreach_prep' when journey is still at brief_ready", async () => {
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

    const data = await loadOutreachView(upsert.projectId!);
    assert.ok(data);
    assert.equal(data?.state, "before_outreach_prep");
    assert.equal(data?.drafts.length, 0);
  });
});

test("loadOutreachView reports 'preparing' when at outreach_prep with no drafts", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    assert.equal(data?.state, "preparing");
    assert.equal(data?.drafts.length, 0);
    assert.equal(data?.journey.step, "outreach_prep");
  });
});

test("loadOutreachView surfaces drafts when at outreach_prep with NEEDS_REVIEW drafts", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);

    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "NEEDS_REVIEW",
        body: "Hi Maya — Saga matched you to a cosmic-romantic ball in LA.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
      },
    });

    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    assert.equal(data?.state, "ready_for_review");
    assert.equal(data?.drafts.length, 1);
    const draft = data!.drafts[0];
    assert.equal(draft.candidateName, "Maya");
    assert.equal(draft.role, "Producer");
    assert.equal(draft.outreachStatus, "draft");
    assert.match(draft.matchRationale, /anime ball/i);
  });
});

test("loadOutreachView surfaces 'awaiting_send' state with type-pinned outreachStatus after approval", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "APPROVED",
        body: "Approved draft body.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
        approvedAt: new Date(),
        approvedBy: "user",
      },
    });
    await advanceJourney(ctx.projectId, "approve_outreach");

    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    assert.equal(data?.state, "awaiting_send");
    assert.equal(data?.drafts[0]?.outreachStatus, "approved_to_send");

    // Journey-driven primary action must surface the gated CTA: not
    // enabled + has a blocked reason explaining the A2P gate.
    assert.equal(data?.journey.primaryAction.enabled, false);
    assert.match(
      data?.journey.primaryAction.blockedReason || "",
      /A2P|Twilio|kill switch/i,
    );
  });
});

test("loadOutreachView never surfaces 'sent' status for drafts without a sentAt timestamp", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);

    // Even if the row status somehow says APPROVED with no sentAt,
    // the view must never label it "sent".
    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "APPROVED",
        body: "Draft body.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
        approvedAt: new Date(),
        approvedBy: "user",
      },
    });

    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    const sentCount = (data?.drafts || []).filter(
      (d) => d.outreachStatus === "sent",
    ).length;
    assert.equal(sentCount, 0);
  });
});

test("loadOutreachView surfaces BLOCKED drafts with their block reason", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);

    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "BLOCKED",
        body: "Blocked draft body.",
        projectId: ctx.projectId,
        candidateRecommendationId: ctx.rec.id,
        recipientKind: "CANDIDATE",
        blockReason: "needs more contact research",
      },
    });

    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    const draft = data!.drafts[0];
    assert.equal(draft.blocked, true);
    assert.match(draft.blockReason || "", /contact research/i);
    assert.equal(draft.outreachStatus, "not_prepared");
  });
});

test("loadOutreachView honesty disclaimer never says 'sent' or 'contacted'", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    const disclaimer = data!.honestyDisclaimer.toLowerCase();
    assert.equal(disclaimer.includes("nothing has been sent"), true);
    // The disclaimer mentions that sending is gated — it doesn't
    // mention "contacted" because nothing has been.
    assert.equal(/has been contacted/i.test(data!.honestyDisclaimer), false);
  });
});

test("loadOutreachView surfaces the correct journey for a fresh project", async () => {
  await withFreshDb(async (db) => {
    const ctx = await setupProjectAtOutreachPrep(db);
    const data = await loadOutreachView(ctx.projectId);
    assert.ok(data);
    const journey = await getOrCreateJourney(ctx.projectId);
    assert.equal(data?.journey.step, journey.step);
    assert.equal(data?.journey.projectId, journey.projectId);
  });
});
