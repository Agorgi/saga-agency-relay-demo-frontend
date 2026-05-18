import assert from "node:assert/strict";
import test from "node:test";
import {
  checkProducerDraftSafety,
  composeCandidateOutreachBody,
  generateCandidateOutreachDraft,
  type CandidateOutreachDraftInput,
} from "@/sms-engine/producer/outboundDrafts";

function approvedInput(
  overrides: Partial<CandidateOutreachDraftInput> = {},
): CandidateOutreachDraftInput {
  return {
    candidateRecommendationId: "rec_1",
    status: "APPROVED_FOR_SHORTLIST",
    optedOut: false,
    role: "photographer",
    city: "Los Angeles",
    displayName: "Maya R. (composite)",
    projectTitle: "Formal ball inspired by Love and Deepspace",
    projectType: "ball",
    matchingReasons: ["Role match: photographer"],
    ...overrides,
  };
}

test("composeCandidateOutreachBody uses the project title verbatim when available", () => {
  const body = composeCandidateOutreachBody(approvedInput());
  assert.match(body, /Formal ball inspired by Love and Deepspace in Los Angeles/);
  // Don't fall back to "a creative project" when we have a real title.
  assert.doesNotMatch(body, /a creative project/);
});

test("composeCandidateOutreachBody falls back to projectType when title is missing", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ projectTitle: null, projectType: "anime picnic" }),
  );
  assert.match(body, /Saga is helping an organizer plan anime picnic in Los Angeles\./);
});

test("composeCandidateOutreachBody falls back to a creative-project generic when neither title nor type is set", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ projectTitle: null, projectType: null }),
  );
  assert.match(body, /Saga is helping an organizer plan a creative project in Los Angeles\./);
});

test("composeCandidateOutreachBody anchors on fandom overlap when the title doesn't already name the fandom", () => {
  // Overlap = "Love and Deepspace"; the title is generic ("Formal ball")
  // so the anchor sentence does meaningful work. Body must mention the
  // fandom anchor AND the role reason — both pieces of personalization
  // land in one message.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectTitle: "Formal ball",
      projectFandoms: ["Love and Deepspace", "anime"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: [
        "Fandom/community fit: Love and Deepspace",
        "Role match: photographer",
      ],
    }),
  );
  assert.match(
    body,
    /They're building it around Love and Deepspace and your work felt aligned\./,
  );
  // Role-specific reason still surfaces (NOT skipped just because there's an overlap).
  assert.match(body, /Your photographer portfolio felt like a fit for the photographer slot\./);
});

test("composeCandidateOutreachBody omits the redundant fandom anchor when the project title already names the fandom", () => {
  // The user-supplied title contains the fandom in the opening
  // sentence — repeating it in the next sentence reads robotic. The
  // composer should drop straight to the role-specific reason instead.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectTitle: "Formal ball inspired by Love and Deepspace",
      projectFandoms: ["Love and Deepspace"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: ["Role match: photographer"],
    }),
  );
  assert.doesNotMatch(body, /They're building it around Love and Deepspace/);
  // Role-specific reason still lands.
  assert.match(body, /Your photographer portfolio felt like a fit for the photographer slot\./);
});

test("composeCandidateOutreachBody drops the duplicate fandom reason when the same fandom is already in the anchor", () => {
  // The producer often emits BOTH a fandom anchor (cohort) AND a fandom
  // matching-reason for the same fandom. The body must not say
  // "Love and Deepspace" twice in different sentences.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectFandoms: ["Love and Deepspace"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: ["Fandom/community fit: Love and Deepspace"],
    }),
  );
  // Exactly one mention of the fandom string.
  const occurrences = body.match(/Love and Deepspace/g) ?? [];
  assert.equal(
    occurrences.length,
    1,
    `expected one mention of Love and Deepspace, got ${occurrences.length} in: ${body}`,
  );
});

test("composeCandidateOutreachBody phrases 'Shared fandom with you' the same as 'Fandom/community fit' (PR #69)", () => {
  // The brief-vs-owner distinction only matters for the host's
  // rationale UI; the candidate-facing outreach body should phrase
  // both the same way. Plus the anchor de-dup must still fire so the
  // fandom isn't mentioned twice.
  const body = composeCandidateOutreachBody(
    approvedInput({
      projectFandoms: ["Genshin Impact"],
      candidateFandoms: ["Genshin Impact"],
      matchingReasons: ["Shared fandom with you: Genshin Impact"],
    }),
  );
  const occurrences = body.match(/Genshin Impact/g) ?? [];
  assert.equal(
    occurrences.length,
    1,
    `expected one mention of Genshin Impact, got ${occurrences.length} in: ${body}`,
  );
  // Body must not leak the internal-facing prefix.
  assert.doesNotMatch(body, /Shared fandom with you/);
});

test("composeCandidateOutreachBody picks a skill-fit reason when there's no fandom overlap", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({
      role: "producer",
      projectFandoms: ["anime"],
      candidateFandoms: ["K-pop"],
      matchingReasons: [
        "Skill fit: production, operations, logistics",
        "Role match: producer",
      ],
    }),
  );
  // Skill comes first in producer's matchingReasons, so it leads.
  assert.match(
    body,
    /Your production and operations experience felt like a fit for the producer slot\./,
  );
  // No fandom anchor (no overlap).
  assert.doesNotMatch(body, /They're building it around/);
});

test("composeCandidateOutreachBody skips generic-trust reasons that don't say anything specific", () => {
  // The producer emits reasons like "Profile reviewed by Saga" and
  // "Has portfolio or social proof" — those don't belong in candidate-
  // facing copy. The composer should drop past them to a real signal.
  const body = composeCandidateOutreachBody(
    approvedInput({
      matchingReasons: [
        "Profile reviewed by Saga",
        "Has portfolio or social proof",
        "Role match: stylist",
      ],
      role: "stylist",
    }),
  );
  assert.doesNotMatch(body, /Profile reviewed/);
  assert.doesNotMatch(body, /portfolio or social proof/);
  assert.match(body, /Your stylist portfolio felt like a fit for the stylist slot\./);
});

test("composeCandidateOutreachBody skips proximity reasons (organizer's network graph isn't a story for candidate-facing copy)", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({
      matchingReasons: [
        "Proximity: friend",
        "Role match: host",
      ],
      role: "host",
    }),
  );
  assert.doesNotMatch(body, /Proximity/);
  assert.doesNotMatch(body, /friend/);
  assert.match(body, /Your host portfolio felt like a fit for the host slot\./);
});

test("composeCandidateOutreachBody falls back to a generic role-fit sentence when no reasons survive the filter", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({
      role: "venue",
      matchingReasons: ["Profile reviewed by Saga", "Has portfolio or social proof"],
    }),
  );
  assert.match(body, /Your work felt like a fit for the venue slot\./);
});

test("composeCandidateOutreachBody handles missing city gracefully", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ city: null }),
  );
  // No " in {city}" tail; sentence should still terminate cleanly.
  assert.match(body, /Saga is helping an organizer plan Formal ball[^.]*\./);
  assert.doesNotMatch(body, /in \./);
  assert.doesNotMatch(body, / in $/);
});

test("composeCandidateOutreachBody handles missing displayName with a soft fallback", () => {
  const body = composeCandidateOutreachBody(
    approvedInput({ displayName: null }),
  );
  assert.match(body, /^Hey there —/);
});

test("composeCandidateOutreachBody body still passes the safety check (open + considered)", () => {
  // checkProducerDraftSafety requires "open" or "interested" AND
  // "considered" in CANDIDATE_OUTREACH bodies. The composer's close
  // line is load-bearing — verify every variant we generate satisfies
  // the rule.
  const variants = [
    approvedInput(),
    approvedInput({ projectTitle: null, projectType: null }),
    approvedInput({
      projectFandoms: ["anime"],
      candidateFandoms: ["anime"],
      matchingReasons: ["Fandom/community fit: anime"],
    }),
    approvedInput({
      matchingReasons: ["Skill fit: production, operations"],
    }),
    approvedInput({ matchingReasons: [], city: null }),
  ];
  for (const variant of variants) {
    const body = composeCandidateOutreachBody(variant);
    const safety = checkProducerDraftSafety({ type: "CANDIDATE_OUTREACH", body });
    assert.equal(
      safety.passed,
      true,
      `safety check failed for variant: ${JSON.stringify(variant)}\nBody: ${body}\nErrors: ${safety.errors.join(" / ")}`,
    );
  }
});

test("generateCandidateOutreachDraft returns BLOCKED with placeholder body when status is not APPROVED_FOR_SHORTLIST", () => {
  const draft = generateCandidateOutreachDraft(
    approvedInput({ status: "SUGGESTED" }),
  );
  assert.equal(draft.status, "BLOCKED");
  assert.match(draft.body, /Blocked draft:/);
  assert.equal(draft.blockReason, "candidate_not_approved_for_shortlist");
});

test("generateCandidateOutreachDraft returns BLOCKED when the candidate is opted out", () => {
  const draft = generateCandidateOutreachDraft(
    approvedInput({ optedOut: true }),
  );
  assert.equal(draft.status, "BLOCKED");
  assert.equal(draft.blockReason, "candidate_opted_out");
});

test("generateCandidateOutreachDraft on an approved candidate produces NEEDS_REVIEW with the personalized body", () => {
  const draft = generateCandidateOutreachDraft(
    approvedInput({
      projectFandoms: ["Love and Deepspace"],
      candidateFandoms: ["Love and Deepspace"],
      matchingReasons: ["Role match: photographer"],
    }),
  );
  assert.equal(draft.status, "NEEDS_REVIEW");
  assert.match(draft.body, /Love and Deepspace/);
  assert.match(draft.body, /Open to being considered for the team/);
  assert.equal(draft.adminReviewRequired, true);
});

test("generateCandidateOutreachDraftsForProject is race-safe under concurrent calls (PR #59)", async () => {
  // Regression for the partial unique index added in
  // `20260518030000_outbounddraft_active_candidate_outreach_unique`.
  // Before the index, two concurrent calls would both see findFirst
  // return null and both create — leaving two non-terminal rows for
  // the same candidateRecommendationId. With the index, the second
  // creator gets P2002 and upsertOutboundDraft retries through the
  // update branch, so exactly one row remains.
  const TEST_DATABASE_URL =
    process.env.PR_L_TEST_DATABASE_URL ||
    "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

  const { PrismaClient } = await import("@prisma/client");
  const { generateCandidateOutreachDraftsForProject } = await import(
    "@/sms-engine/producer/outboundDrafts"
  );

  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    // Clean dependency tree
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

    // Minimal fixture: Project + RoleOpening + Opportunity + Person +
    // CandidateRecommendation in APPROVED_FOR_SHORTLIST (the status
    // generateCandidateOutreachDraftsForProject pulls).
    const project = await db.project.create({
      data: { source: "WEB_APP", title: "Race fixture", city: "Los Angeles" },
    });
    const role = await db.roleOpening.create({
      data: {
        projectId: project.id,
        roleType: "photographer",
        title: "Photographer",
        status: "OPEN",
      },
    });
    const opportunity = await db.opportunity.create({
      data: {
        roleOpeningId: role.id,
        visibility: "PRIVATE",
        applicationMode: "INVITE_ONLY",
        status: "ACTIVE",
      },
    });
    const person = await db.person.create({
      data: { name: "Composite Maya", source: "DEMO_COMPOSITE" },
    });
    await db.creatorProfile.create({
      data: {
        personId: person.id,
        displayName: "Composite Maya",
        roles: ["photographer"],
        reviewStatus: "APPROVED",
      },
    });
    await db.candidateRecommendation.create({
      data: {
        opportunityId: opportunity.id,
        personId: person.id,
        score: 0.85,
        matchingReasons: ["Role match: photographer"],
        risks: [],
        status: "APPROVED_FOR_SHORTLIST",
      },
    });

    // Fire two concurrent draft generations for the same project.
    // Pre-PR-59 this races and creates two non-terminal drafts. After
    // PR #59 the partial unique constraint catches the duplicate
    // create and upsertOutboundDraft falls through to update.
    await Promise.all([
      generateCandidateOutreachDraftsForProject(project.id),
      generateCandidateOutreachDraftsForProject(project.id),
    ]);

    const drafts = await db.outboundDraft.findMany({
      where: { projectId: project.id, type: "CANDIDATE_OUTREACH" },
    });
    assert.equal(
      drafts.length,
      1,
      `expected exactly one CANDIDATE_OUTREACH draft per candidate after concurrent generations, got ${drafts.length}`,
    );
  } finally {
    await db.$disconnect();
  }
});

test("upsertOutboundDraft preserves multi-history when an earlier draft is in a terminal status", async () => {
  // The partial unique constraint is scoped to non-terminal statuses
  // (DRAFT / NEEDS_REVIEW / BLOCKED). A terminal-status draft (APPROVED,
  // SENT, REJECTED) plus a new non-terminal draft for the same candidate
  // is the existing multi-history pattern in upsertOutboundDraft — the
  // constraint must NOT forbid that.
  const TEST_DATABASE_URL =
    process.env.PR_L_TEST_DATABASE_URL ||
    "postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public";
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.POSTGRES_URL_NON_POOLING = TEST_DATABASE_URL;

  const { PrismaClient } = await import("@prisma/client");
  const { generateCandidateOutreachDraftsForProject } = await import(
    "@/sms-engine/producer/outboundDrafts"
  );

  const db = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
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

    const project = await db.project.create({
      data: { source: "WEB_APP", title: "Terminal-history fixture", city: "Los Angeles" },
    });
    const role = await db.roleOpening.create({
      data: {
        projectId: project.id,
        roleType: "photographer",
        title: "Photographer",
        status: "OPEN",
      },
    });
    const opportunity = await db.opportunity.create({
      data: {
        roleOpeningId: role.id,
        visibility: "PRIVATE",
        applicationMode: "INVITE_ONLY",
        status: "ACTIVE",
      },
    });
    const person = await db.person.create({
      data: { name: "Composite Maya", source: "DEMO_COMPOSITE" },
    });
    await db.creatorProfile.create({
      data: {
        personId: person.id,
        displayName: "Composite Maya",
        roles: ["photographer"],
        reviewStatus: "APPROVED",
      },
    });
    const rec = await db.candidateRecommendation.create({
      data: {
        opportunityId: opportunity.id,
        personId: person.id,
        score: 0.85,
        matchingReasons: ["Role match: photographer"],
        risks: [],
        status: "APPROVED_FOR_SHORTLIST",
      },
    });

    // Insert a terminal-status draft directly. The partial unique
    // excludes terminal rows, so this should not block a new
    // non-terminal draft for the same candidate.
    await db.outboundDraft.create({
      data: {
        type: "CANDIDATE_OUTREACH",
        status: "APPROVED",
        body: "Old draft body (terminal).",
        source: "PRODUCER_AGENT",
        projectId: project.id,
        candidateRecommendationId: rec.id,
        recipientKind: "CANDIDATE",
        metadata: {},
        approvedAt: new Date(),
      },
    });

    // Now generate fresh drafts — creates a new NEEDS_REVIEW row.
    await generateCandidateOutreachDraftsForProject(project.id);

    const drafts = await db.outboundDraft.findMany({
      where: {
        projectId: project.id,
        type: "CANDIDATE_OUTREACH",
        candidateRecommendationId: rec.id,
      },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(
      drafts.length,
      2,
      "terminal-status draft + new non-terminal draft must both exist",
    );
    const statuses = drafts.map((d) => d.status).sort();
    assert.deepEqual(statuses.sort(), ["APPROVED", "NEEDS_REVIEW"].sort());
  } finally {
    await db.$disconnect();
  }
});
