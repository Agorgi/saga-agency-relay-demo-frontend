import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { generateCrewForProject } from "@/lib/projectCrewGeneration";
import { upsertProjectFromBrief } from "@/lib/projectBriefUpsert";

const TEST_DATABASE_URL =
  process.env.PR_L_TEST_DATABASE_URL ||
  "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

async function withFreshDb<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    // Clean in dependency order (CandidateRecommendation → Opportunity →
    // RoleOpening → CreatorProfile / Person → Project / WebSession).
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

test("generateCrewForProject throws when the project doesn't exist", async () => {
  await withFreshDb(async () => {
    await assert.rejects(
      generateCrewForProject("cm0nonexistentproject0000"),
      /project .* not found/,
    );
  });
});

test("generateCrewForProject skips when the project has no brief signal at all", async () => {
  await withFreshDb(async (db) => {
    // A Project row created with NO title, description, fandoms — i.e. a
    // session that pinged the chat once but never gave Sagasan anything
    // to grab. Generation must not invent roles from nothing.
    const project = await db.project.create({
      data: { source: "WEB_APP" },
      select: { id: true },
    });
    const result = await generateCrewForProject(project.id);
    assert.equal(result.skipped, "no_organizer_project");
    assert.equal(result.rolesCreated, 0);
    assert.equal(result.candidatesCreated, 0);

    const roleCount = await db.roleOpening.count({
      where: { projectId: project.id },
    });
    assert.equal(roleCount, 0);
  });
});

test("generateCrewForProject is idempotent — second call short-circuits", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const first = await generateCrewForProject(upsert.projectId!);
    assert.equal(first.skipped, undefined);
    assert.ok(first.rolesCreated > 0, "first call should create roles");

    const roleCountAfterFirst = await db.roleOpening.count({
      where: { projectId: upsert.projectId! },
    });

    const second = await generateCrewForProject(upsert.projectId!);
    assert.equal(second.skipped, "already_generated");
    assert.equal(second.rolesCreated, 0);
    assert.equal(second.candidatesCreated, 0);

    const roleCountAfterSecond = await db.roleOpening.count({
      where: { projectId: upsert.projectId! },
    });
    assert.equal(
      roleCountAfterSecond,
      roleCountAfterFirst,
      "no new roles on idempotent re-run",
    );
  });
});

test("generateCrewForProject persists RoleOpening + Opportunity rows for a chat-created project", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const result = await generateCrewForProject(upsert.projectId!);
    assert.equal(result.skipped, undefined);
    assert.ok(result.rolesCreated >= 1, "at least one role is required");

    const roles = await db.roleOpening.findMany({
      where: { projectId: upsert.projectId! },
      include: { opportunities: true },
    });

    // Every role has an OPEN status and an ACTIVE Opportunity attached.
    for (const role of roles) {
      assert.equal(role.status, "OPEN", `role ${role.title} should be OPEN`);
      assert.equal(
        role.opportunities.length,
        1,
        `role ${role.title} should have exactly one Opportunity`,
      );
      assert.equal(role.opportunities[0].status, "ACTIVE");
      assert.equal(role.opportunities[0].visibility, "PRIVATE");
      assert.equal(role.opportunities[0].applicationMode, "INVITE_ONLY");
    }

    // The producer engine includes a Production Lead as a required role
    // for every organizer project — sanity-check that the producer's
    // deterministic role-map ran.
    assert.ok(
      roles.some((r) => /production lead/i.test(r.title)),
      "production lead must appear in role list",
    );
  });
});

test("generateCrewForProject scores internal CreatorProfile candidates against the roles", async () => {
  await withFreshDb(async (db) => {
    // Seed a small creator pool that overlaps with the brief's expected
    // role mix.
    const person = await db.person.create({
      data: { name: "Maya Producer", source: "ADMIN", city: "Los Angeles" },
    });
    await db.creatorProfile.create({
      data: {
        personId: person.id,
        displayName: "Maya Producer",
        city: "Los Angeles",
        roles: ["production lead", "producer"],
        skills: ["production", "operations", "logistics"],
        fandoms: ["Love and Deepspace"],
        communities: ["LA creator scene"],
        portfolioUrls: ["https://example.com/maya/portfolio"],
        socialUrls: ["https://instagram.com/maya"],
        reviewStatus: "APPROVED",
      },
    });

    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const result = await generateCrewForProject(upsert.projectId!);
    assert.ok(
      result.rolesCreated > 0,
      `expected roles to be created, got ${JSON.stringify(result)}`,
    );
    assert.ok(
      result.candidatesCreated && result.candidatesCreated > 0,
      `expected the seeded Maya to score onto at least one role, got ${JSON.stringify(result)}`,
    );

    const recommendations = await db.candidateRecommendation.findMany({
      where: { personId: person.id },
      include: { opportunity: { include: { roleOpening: true } } },
    });
    assert.ok(
      recommendations.length > 0,
      "Maya should appear as a recommendation on at least one role",
    );

    // No proximity context (chat-created projects don't set organizerPersonId),
    // so all recommendations should land at UNKNOWN proximity — that's
    // honest: we have no relationship-graph signal for chat-tracer projects.
    for (const rec of recommendations) {
      assert.equal(rec.proximityTier, "UNKNOWN");
    }
  });
});

test("generateCrewForProject returns rolesCreated > 0 even when CreatorProfile pool is empty", async () => {
  // Roles are valuable on their own — design partners see the producer's
  // role list even before any internal candidates exist. The empty-pool
  // case is the most likely state in early staging.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const result = await generateCrewForProject(upsert.projectId!);
    assert.equal(result.skipped, undefined);
    assert.ok(result.rolesCreated > 0, "roles must be created");
    assert.equal(
      result.candidatesCreated,
      0,
      "no candidates expected when CreatorProfile pool is empty",
    );

    const roleCount = await db.roleOpening.count({
      where: { projectId: upsert.projectId! },
    });
    assert.equal(roleCount, result.rolesCreated);
  });
});
