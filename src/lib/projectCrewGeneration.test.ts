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

test("generateCrewForProject is race-safe when fired concurrently on the same fresh project", async () => {
  // Regression for PR #53: two concurrent /crew page loads (browser
  // tabs, double-click, etc.) used to race the count-then-create
  // pattern, both seeing existingRoleCount=0 and both proceeding to
  // create the same role set. With the schema-level
  // RoleOpening @@unique([projectId, roleType]) constraint plus
  // P2002-handling in the generator, the second creator now adopts
  // the first one's rows and no duplicates land.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    // Fire both generators concurrently. Promise.all is the realistic
    // approximation of two simultaneous /crew page renders.
    const [resultA, resultB] = await Promise.all([
      generateCrewForProject(upsert.projectId!),
      generateCrewForProject(upsert.projectId!),
    ]);

    // No duplicate RoleOpenings — the unique constraint guarantees this.
    const roles = await db.roleOpening.findMany({
      where: { projectId: upsert.projectId! },
      select: { roleType: true },
    });
    const roleTypes = roles.map((r) => r.roleType);
    const uniqueRoleTypes = new Set(roleTypes);
    assert.equal(
      roleTypes.length,
      uniqueRoleTypes.size,
      `expected one row per role type, got duplicates: ${JSON.stringify(roleTypes)}`,
    );
    assert.ok(roleTypes.length > 0, "at least one role should have been created");

    // No duplicate Opportunities (one per RoleOpening).
    const opportunities = await db.opportunity.findMany({
      where: { roleOpening: { projectId: upsert.projectId! } },
      select: { roleOpeningId: true },
    });
    const opportunityRoleIds = opportunities.map((o) => o.roleOpeningId);
    assert.equal(
      opportunityRoleIds.length,
      new Set(opportunityRoleIds).size,
      "each RoleOpening should have at most one Opportunity",
    );
    assert.equal(opportunityRoleIds.length, roles.length);

    // Both calls returned. At least one should report having created roles
    // OR adopted the existing ones via the P2002 path. The combined
    // candidatesCreated count from both calls is allowed to exceed the
    // unique recommendation count (the second pass calls upsert on
    // CandidateRecommendation rows the first pass created — that's fine,
    // CandidateRecommendation has its own @@unique([opportunityId,
    // personId])).
    for (const result of [resultA, resultB]) {
      assert.ok(
        result.skipped !== undefined ||
          (typeof result.rolesCreated === "number" && result.rolesCreated >= 0),
        `result must report skipped or rolesCreated, got: ${JSON.stringify(result)}`,
      );
    }
  });
});

test("generateCrewForProject coexists with an existing duplicate role landed before the migration", async () => {
  // The migration deduped any pre-existing duplicates and added the
  // unique constraint. Verify that after seeding a single role for a
  // project, generateCrewForProject doesn't try to recreate it and the
  // unique constraint stays clean. This mirrors the "return visit"
  // path on a project that was generated by an older code version.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    // Seed one role manually (simulating partial state from a prior run).
    await db.roleOpening.create({
      data: {
        projectId: upsert.projectId!,
        roleType: "production lead",
        title: "Lightweight Production Lead",
        status: "OPEN",
      },
    });

    // generateCrewForProject's idempotency fast-path should short-circuit
    // because count > 0. No need for P2002 handling.
    const result = await generateCrewForProject(upsert.projectId!);
    assert.equal(result.skipped, "already_generated");

    // Confirm no duplicate of the seeded role landed.
    const roleCount = await db.roleOpening.count({
      where: {
        projectId: upsert.projectId!,
        roleType: "production lead",
      },
    });
    assert.equal(roleCount, 1);
  });
});

test("generateCrewForProject pulls owner's Person.fandoms into understanding (PR #68)", async () => {
  // The motivating scenario: the user mentioned "Genshin Impact" in
  // an early chat turn (regex / LLM captured it on Person.fandoms),
  // but the brief itself never re-mentioned it — so Project.fandoms
  // doesn't contain it. PR #68 unions Person.fandoms in before
  // scoring, so a creator who shares "Genshin Impact" still gets
  // the fandomFit boost in `scoreCandidateForRole`.
  await withFreshDb(async (db) => {
    // Seed two producers, both with the same role/skill profile;
    // one shares the owner's Person.fandoms, the other doesn't.
    const personGenshinFan = await db.person.create({
      data: { name: "Maya Producer", source: "ADMIN", city: "Los Angeles" },
    });
    await db.creatorProfile.create({
      data: {
        personId: personGenshinFan.id,
        displayName: "Maya Producer",
        city: "Los Angeles",
        roles: ["production lead", "producer"],
        skills: ["production", "operations"],
        fandoms: ["Genshin Impact"],
        portfolioUrls: ["https://example.com/maya"],
        reviewStatus: "APPROVED",
      },
    });
    const personUnrelated = await db.person.create({
      data: { name: "Jordan Producer", source: "ADMIN", city: "Los Angeles" },
    });
    await db.creatorProfile.create({
      data: {
        personId: personUnrelated.id,
        displayName: "Jordan Producer",
        city: "Los Angeles",
        roles: ["production lead", "producer"],
        skills: ["production", "operations"],
        fandoms: ["EDM"],
        portfolioUrls: ["https://example.com/jordan"],
        reviewStatus: "APPROVED",
      },
    });

    // The session's anchor Person carries "Genshin Impact" — which is
    // NOT in the brief (completeBrief mentions Love and Deepspace only).
    const ownerPerson = await db.person.create({
      data: {
        name: "[session] owner",
        source: "APP",
        fandoms: ["Genshin Impact"],
      },
    });
    const session = await db.webSession.create({
      data: { personId: ownerPerson.id },
    });

    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    // Sanity: the upsert wired organizerPersonId from the session.
    const project = await db.project.findUnique({
      where: { id: upsert.projectId! },
      select: { organizerPersonId: true, fandoms: true },
    });
    assert.equal(project?.organizerPersonId, ownerPerson.id);
    // The brief itself doesn't contain Genshin Impact — only the
    // Person row does. That's the whole point of the boost.
    assert.ok(
      !project?.fandoms.includes("Genshin Impact"),
      "test assumption broken: Genshin Impact should NOT be on Project.fandoms",
    );

    const result = await generateCrewForProject(upsert.projectId!);
    assert.ok(result.rolesCreated > 0);
    assert.ok(
      result.candidatesCreated && result.candidatesCreated > 0,
      `expected candidates to be scored, got ${JSON.stringify(result)}`,
    );

    // Genshin Maya should outrank EDM Jordan on the producer role
    // BECAUSE the owner's Person.fandoms got plumbed into scoring.
    // Look at recommendations on the same role and compare scores.
    const recommendations = await db.candidateRecommendation.findMany({
      include: { opportunity: { include: { roleOpening: true } } },
      orderBy: { score: "desc" },
    });
    const mayaRecs = recommendations.filter(
      (r) => r.personId === personGenshinFan.id,
    );
    const jordanRecs = recommendations.filter(
      (r) => r.personId === personUnrelated.id,
    );
    assert.ok(mayaRecs.length > 0, "Maya must be scored on at least one role");
    assert.ok(
      jordanRecs.length > 0,
      "Jordan must be scored on at least one role",
    );
    // Compare top score per producer head-to-head.
    const mayaTop = Math.max(...mayaRecs.map((r) => r.score));
    const jordanTop = Math.max(...jordanRecs.map((r) => r.score));
    assert.ok(
      mayaTop > jordanTop,
      `Maya (shares owner's Genshin Impact fandom) should outscore Jordan (no overlap). Got Maya=${mayaTop}, Jordan=${jordanTop}.`,
    );

    // PR #69: Maya's matchingReasons should label the Genshin Impact
    // overlap as a "Shared fandom with you" line (owner-driven), not
    // a generic "Fandom/community fit" line. This is the visible
    // rationale story the host sees in the candidate review UI.
    const mayaTopRec = mayaRecs.find((r) => r.score === mayaTop)!;
    const mayaReasonsStr = mayaTopRec.matchingReasons.join(" | ");
    assert.match(
      mayaReasonsStr,
      /Shared fandom with you:\s*Genshin Impact/,
      `expected "Shared fandom with you: Genshin Impact" in Maya's reasons; got: ${mayaReasonsStr}`,
    );
  });
});

test("generateCrewForProject leaves understanding unchanged when owner has no fandoms (PR #68)", async () => {
  // Defensive baseline — make sure the enrichment helper is a no-op
  // when there's nothing to add, not silently dropping briefs.
  await withFreshDb(async (db) => {
    const ownerPerson = await db.person.create({
      data: { name: "[session] empty", source: "APP", fandoms: [] },
    });
    const session = await db.webSession.create({
      data: { personId: ownerPerson.id },
    });

    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const result = await generateCrewForProject(upsert.projectId!);
    assert.ok(result.rolesCreated > 0, "roles still generated normally");
  });
});

test("upsertProjectFromBrief sets organizerPersonId from the session's Person (PR #68)", async () => {
  // The wiring step that makes the producer-scoring boost work.
  await withFreshDb(async (db) => {
    const ownerPerson = await db.person.create({
      data: { name: "[session] owner", source: "APP" },
    });
    const session = await db.webSession.create({
      data: { personId: ownerPerson.id },
    });

    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });

    assert.ok(upsert.projectId);
    const project = await db.project.findUnique({
      where: { id: upsert.projectId! },
      select: { organizerPersonId: true },
    });
    assert.equal(project?.organizerPersonId, ownerPerson.id);
  });
});

test("upsertProjectFromBrief backfills organizerPersonId on existing projects (PR #68)", async () => {
  // Race-safety: PR #64 attaches Person.id to the session AFTER the
  // session may already have created a Project. The next chat turn
  // should heal that link rather than leave the orphaned project
  // forever unattached.
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });

    // First turn: no Person yet, project gets created without owner.
    const firstUpsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(firstUpsert.projectId);
    const projectBefore = await db.project.findUnique({
      where: { id: firstUpsert.projectId! },
      select: { organizerPersonId: true },
    });
    assert.equal(projectBefore?.organizerPersonId, null);

    // Now attach a Person (mirrors what PR #64's
    // upsertSessionIdentitySignals would do on a fandom-bearing turn).
    const owner = await db.person.create({
      data: { name: "[session] owner", source: "APP", fandoms: ["anime"] },
    });
    await db.webSession.update({
      where: { id: session.id },
      data: { personId: owner.id },
    });

    // Next turn: upsert sees the existing project + the now-attached
    // Person and backfills the link.
    await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    const projectAfter = await db.project.findUnique({
      where: { id: firstUpsert.projectId! },
      select: { organizerPersonId: true },
    });
    assert.equal(projectAfter?.organizerPersonId, owner.id);
  });
});

test("generateCrewForProject persists multiple seeded composites in a single batched write (PR #60)", async () => {
  // PR #60 replaced the per-row `upsert` loop with a single
  // `createMany({ skipDuplicates: true })` call. This test
  // exercises the batched path by seeding a pool large enough
  // to produce multiple candidate recommendations per role and
  // verifying they all land. Doesn't directly assert the
  // round-trip count (Prisma's API doesn't expose that), but a
  // regression that put back the per-row upsert would still pass
  // this test — the value is documenting the expected behavior
  // with multiple persistence targets.
  await withFreshDb(async (db) => {
    // Seed three composite producers — the producer's role map
    // will surface "production lead" as a required role, so all
    // three score against the same opportunity.
    for (let i = 0; i < 3; i++) {
      const person = await db.person.create({
        data: {
          name: `Maya ${i} (composite)`,
          source: "DEMO_COMPOSITE",
          city: "Los Angeles",
        },
      });
      await db.creatorProfile.create({
        data: {
          personId: person.id,
          displayName: `Maya ${i} (composite)`,
          city: "Los Angeles",
          roles: ["production lead"],
          skills: ["production", "operations"],
          fandoms: ["Love and Deepspace"],
          reviewStatus: "APPROVED",
        },
      });
    }

    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.ok(upsert.projectId);

    const result = await generateCrewForProject(upsert.projectId!);
    assert.ok(
      result.candidatesCreated && result.candidatesCreated >= 3,
      `expected ≥3 candidates created via the batched write, got ${result.candidatesCreated}`,
    );

    // The batched write persists everything in one shot; verify
    // the DB row count matches the function's reported count.
    const rowCount = await db.candidateRecommendation.count();
    assert.equal(
      rowCount,
      result.candidatesCreated,
      "rowCount must match candidatesCreated — batched write should be atomic",
    );
  });
});
