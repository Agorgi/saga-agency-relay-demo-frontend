import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { loadCrewView } from "@/lib/projectCrewView";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";

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
  desiredTalentRoles: ["Producer", "Stylist"],
};

test("loadCrewView returns null for non-cuid slugs", async () => {
  const result = await loadCrewView("anime-picnic-silver-lake");
  assert.equal(result, null);
});

test("loadCrewView returns null when the project doesn't exist", async () => {
  await withFreshDb(async () => {
    const result = await loadCrewView("cm0000000000000000000000");
    assert.equal(result, null);
  });
});

test("loadCrewView auto-advances brief_ready → crew_reviewing and materializes roles on first load", async () => {
  // PR #50 wires the producer engine into loadCrewView's first-load
  // path, so a fresh brief_ready project now arrives with roles
  // already persisted — the "researching" empty state is reserved
  // for projects with no brief signal at all (no title, no
  // description, no fandoms) and for the rare case where the
  // generator skips because of sourceKind mismatch.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.equal(upsert.journey?.step, "brief_ready");

    const data = await loadCrewView(upsert.projectId!);
    assert.ok(data);
    assert.equal(data?.journey.step, "crew_reviewing");
    assert.ok(
      (data?.roles.length ?? 0) > 0,
      "first /crew visit materializes producer roles",
    );
    assert.equal(data?.state, "ready");

    // Brief snapshot pulled from the Project columns.
    const factLabels = data?.briefSnapshot.facts.map((f) => f.label) ?? [];
    assert.ok(factLabels.includes("Where"));
    assert.ok(factLabels.includes("When"));
    assert.ok(factLabels.includes("Budget"));
  });
});

test("loadCrewView is idempotent — second load stays at crew_reviewing, no re-advance", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });

    const first = await loadCrewView(upsert.projectId!);
    const second = await loadCrewView(upsert.projectId!);
    assert.equal(first?.journey.step, "crew_reviewing");
    assert.equal(second?.journey.step, "crew_reviewing");
  });
});

test("loadCrewView surfaces OPEN roles with candidate counts", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });

    const producerRole = await db.roleOpening.create({
      data: {
        projectId: upsert.projectId!,
        roleType: "producer",
        title: "Producer",
        description: "Coordinates vendors, timeline, day-of-show.",
        status: "OPEN",
      },
    });
    await db.roleOpening.create({
      data: {
        projectId: upsert.projectId!,
        roleType: "stylist",
        title: "Stylist",
        description: "Sets the look — wardrobe, hair, makeup, props.",
        status: "DRAFT", // shouldn't surface
      },
    });

    // No candidates yet.
    let data = await loadCrewView(upsert.projectId!);
    assert.equal(data?.roles.length, 1);
    assert.equal(data?.roles[0]?.title, "Producer");
    assert.equal(data?.roles[0]?.candidateCount, 0);
    assert.equal(data?.roles[0]?.approvedCount, 0);

    // Add an opportunity with two candidates, one approved.
    const opportunity = await db.opportunity.create({
      data: {
        roleOpeningId: producerRole.id,
        visibility: "PRIVATE",
        applicationMode: "INVITE_ONLY",
        status: "ACTIVE",
      },
    });
    const personA = await db.person.create({
      data: { name: "Maya Okafor", source: "ADMIN" },
    });
    const personB = await db.person.create({
      data: { name: "Jordan Wei", source: "ADMIN" },
    });
    await db.candidateRecommendation.create({
      data: {
        opportunityId: opportunity.id,
        personId: personA.id,
        status: "APPROVED_FOR_SHORTLIST",
        score: 0.9,
      },
    });
    await db.candidateRecommendation.create({
      data: {
        opportunityId: opportunity.id,
        personId: personB.id,
        status: "SUGGESTED",
        score: 0.7,
      },
    });

    data = await loadCrewView(upsert.projectId!);
    assert.equal(data?.roles[0]?.candidateCount, 2);
    assert.equal(data?.roles[0]?.approvedCount, 1);
    assert.equal(
      data?.roles[0]?.reviewHref,
      `/projects/${upsert.projectId}/crew/${producerRole.id}`,
    );
  });
});
