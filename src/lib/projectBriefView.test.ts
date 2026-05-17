import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { loadBriefReview, looksLikeProjectId } from "@/lib/projectBriefView";
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

test("looksLikeProjectId distinguishes cuid from fixture slugs", () => {
  assert.equal(looksLikeProjectId("cm1abc123def456ghi789jk"), true);
  assert.equal(looksLikeProjectId("c1234567890123456789012"), true);

  // Fixture-style slugs are kebab-case English — never start with a single c
  // followed by 20+ alphanumerics.
  assert.equal(looksLikeProjectId("anime-picnic-silver-lake"), false);
  assert.equal(looksLikeProjectId("beauty-brand-content-day"), false);
  assert.equal(looksLikeProjectId("c"), false); // too short
  assert.equal(looksLikeProjectId(""), false);
});

test("loadBriefReview returns null for non-cuid slugs without hitting the DB", async () => {
  const result = await loadBriefReview("anime-picnic-silver-lake");
  assert.equal(result, null);
});

test("loadBriefReview returns null when the cuid doesn't match a Project", async () => {
  await withFreshDb(async () => {
    const result = await loadBriefReview("cm0000000000000000000000");
    assert.equal(result, null);
  });
});

test("loadBriefReview returns brief data + journey for a real Project at intake", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: minimalBrief,
    });
    assert.ok(upsert.projectId);

    const data = await loadBriefReview(upsert.projectId!);
    assert.ok(data);
    assert.equal(data?.projectId, upsert.projectId);
    assert.match(data?.title || "", /Formal ball/);
    assert.equal(data?.journey.step, "intake");
    assert.match(data?.editChatHref || "", new RegExp(`projectId=${upsert.projectId}`));

    // The facts list reflects the persisted fields. Minimal brief sets
    // city and dateWindow only.
    const labels = (data?.facts ?? []).map((f) => f.label);
    assert.ok(labels.includes("Location"));
    assert.ok(labels.includes("When"));
  });
});

test("loadBriefReview surfaces the brief_ready primary action once readiness crosses", async () => {
  await withFreshDb(async (db) => {
    const session = await db.webSession.create({ data: {} });
    const upsert = await upsertProjectFromBrief({
      sessionId: session.id,
      persona: "host",
      organizerFields: completeBrief,
    });
    assert.equal(upsert.journey?.step, "brief_ready");

    const data = await loadBriefReview(upsert.projectId!);
    assert.ok(data);
    assert.equal(data?.journey.step, "brief_ready");
    assert.equal(data?.journey.primaryAction.enabled, true);
    assert.match(data?.journey.primaryAction.label || "", /Build my crew/);
    assert.equal(
      data?.journey.primaryAction.href,
      `/projects/${upsert.projectId}/crew`,
    );

    // Brief fact list reflects the rich brief.
    const labels = (data?.facts ?? []).map((f) => f.label);
    assert.ok(labels.includes("Location"));
    assert.ok(labels.includes("Budget"));
    assert.ok(labels.includes("References"));
    assert.ok(labels.includes("Vibe"));
  });
});

test("loadBriefReview produces no facts and a placeholder copy when the project is empty", async () => {
  await withFreshDb(async (db) => {
    const project = await db.project.create({
      data: { source: "WEB_APP" },
      select: { id: true },
    });

    const data = await loadBriefReview(project.id);
    assert.ok(data);
    assert.equal(data?.facts.length, 0);
    assert.equal(data?.title, "Your project");
  });
});
